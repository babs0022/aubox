-- Fund Flow Analysis Query for Forensic Tracing
-- Traces all token movements from a starting wallet across all chains
-- Identifies bridges, exchanges, DEX protocols, and staking contracts
-- Time window: customizable via parameter (default 90 days from start_timestamp)

WITH
  starting_wallet AS (
    SELECT TRY(FROM_HEX(REGEXP_REPLACE(LOWER('{{wallet_address}}'), '^0x', ''))) AS address
  ),
  
  -- Get all outgoing transfers from the hacked wallet (first-level)
  direct_transfers AS (
    SELECT
      blockchain,
      'outgoing' AS flow_direction,
      1 AS hop_level,
      "from" AS from_address,
      "to" AS to_address,
      contract_address,
      amount,
      amount_usd,
      tx_hash,
      block_time,
      CAST(NULL AS varchar) AS protocol_type,
      CAST(NULL AS varchar) AS protocol_name
    FROM tokens.transfers
    WHERE
      "from" = (SELECT address FROM starting_wallet)
      AND (SELECT address FROM starting_wallet) IS NOT NULL
      AND TO_UNIXTIME(block_time) >= CAST('{{start_timestamp}}' AS bigint)
      AND TO_UNIXTIME(block_time) <= CAST('{{start_timestamp}}' AS bigint) + 7776000
      AND (
        '{{tx_hash}}' = ''
        OR tx_hash = TRY(FROM_HEX(REGEXP_REPLACE(LOWER('{{tx_hash}}'), '^0x', '')))
      )
  ),
  
  -- Enrich direct transfers with protocol classifications
  direct_with_labels AS (
    SELECT
      dt.blockchain,
      dt.flow_direction,
      dt.hop_level,
      dt.from_address,
      dt.to_address,
      dt.contract_address,
      dt.amount,
      dt.amount_usd,
      dt.tx_hash,
      dt.block_time,
      CASE
        WHEN l1.category = 'bridge' THEN 'bridge'
        WHEN l1.category = 'exchange' THEN 'exchange'
        WHEN l1.category = 'dex' THEN 'dex'
        WHEN l1.category = 'staking' THEN 'staking'
        WHEN l1.category = 'contract' THEN 'contract'
        ELSE NULL
      END AS protocol_type,
      COALESCE(l1.name, CONCAT('0x', LOWER(TO_HEX(dt.to_address)))) AS protocol_name,
      l1.category,
      l1.address AS labeled_address
    FROM direct_transfers dt
    LEFT JOIN labels.addresses l1 ON 
      dt.to_address = l1.address
      AND dt.blockchain = l1.blockchain
    WHERE dt.to_address IS NOT NULL
  ),

  -- Get second-level transfers (from recipients of direct transfers)
  -- Used to track where bridges/exchanges send funds
  secondary_transfers AS (
    SELECT
      dt.blockchain,
      'incoming' AS flow_direction,
      2 AS hop_level,
      dt."from" AS from_address,
      dt."to" AS to_address,
      dt.contract_address,
      dt.amount,
      dt.amount_usd,
      dt.tx_hash,
      dt.block_time,
      CASE
        WHEN l2.category = 'bridge' THEN 'bridge'
        WHEN l2.category = 'exchange' THEN 'exchange'
        WHEN l2.category = 'dex' THEN 'dex'
        WHEN l2.category = 'staking' THEN 'staking'
        WHEN l2.category = 'contract' THEN 'contract'
        ELSE NULL
      END AS protocol_type,
      COALESCE(l2.name, CONCAT('0x', LOWER(TO_HEX(dt."to")))) AS protocol_name,
      l2.category,
      l2.address AS labeled_address
    FROM tokens.transfers dt
    INNER JOIN direct_with_labels dwl ON
      dt."from" = dwl.to_address
      AND dt.blockchain = dwl.blockchain
    LEFT JOIN labels.addresses l2 ON
      dt."to" = l2.address
      AND dt.blockchain = l2.blockchain
    WHERE
      TO_UNIXTIME(dt.block_time) >= CAST('{{start_timestamp}}' AS bigint)
      AND TO_UNIXTIME(dt.block_time) <= CAST('{{start_timestamp}}' AS bigint) + 7776000
  ),

  -- Combine all transfers
  all_transfers AS (
    SELECT * FROM direct_with_labels
    UNION ALL
    SELECT * FROM secondary_transfers
  ),

  -- Aggregate fund flows grouped by destination
  fund_flow_aggregates AS (
    SELECT
      blockchain,
      to_address,
      protocol_name,
      protocol_type,
      category,
      COUNT(DISTINCT tx_hash) AS tx_count,
      COUNT(DISTINCT CASE WHEN flow_direction = 'outgoing' THEN tx_hash END) AS outgoing_txs,
      COUNT(DISTINCT CASE WHEN flow_direction = 'incoming' THEN tx_hash END) AS incoming_txs,
      SUM(amount_usd) AS total_usd,
      AVG(amount_usd) AS avg_amount_usd,
      MIN(block_time) AS first_activity,
      MAX(block_time) AS last_activity,
      ARRAY_JOIN(ARRAY_DISTINCT(ARRAY_AGG(CAST(tx_hash AS varchar))), ',') AS tx_hashes
    FROM all_transfers
    WHERE to_address IS NOT NULL AND amount_usd > 0
    GROUP BY blockchain, to_address, protocol_name, protocol_type, category
  )

-- Final result set
SELECT
  blockchain,
  CONCAT('0x', LOWER(TO_HEX(to_address))) AS entity_address,
  protocol_name,
  protocol_type,
  tx_count,
  outgoing_txs,
  incoming_txs,
  total_usd,
  avg_amount_usd,
  first_activity,
  last_activity,
  tx_hashes,
  'transfer' AS result_type
FROM fund_flow_aggregates
WHERE total_usd > 0
ORDER BY total_usd DESC, first_activity ASC
