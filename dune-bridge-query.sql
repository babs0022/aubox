-- DUNE QUERY: BRIDGE EXPOSURE
-- This query is designed to work with your current backend call pattern:
--   GET /query/{id}/results?filters={"address":"0x...","chain":"ethereum"}
--
-- IMPORTANT:
-- - Include BOTH `address` and `chain` columns so Dune API filters can apply.
-- - Keep `blockchain` as the canonical chain output used by backend normalization.
--
-- Output columns required by backend:
--   blockchain, address, chain, bridge_name, bridge_address,
--   tx_count, inflow_txs, outflow_txs,
--   total_amount_usd, avg_amount_usd,
--   first_seen, last_seen, activity_span_days

with address_labels as (
	select
		lower(blockchain) as blockchain,
		concat('0x', lower(to_hex(address))) as address,
		max_by(name, updated_at) as label_name,
		max_by(category, updated_at) as category_name
	from labels.addresses
	group by 1, 2
),

recent_transfers as (
	select
		lower(t.blockchain) as blockchain,
		concat('0x', lower(to_hex(t."from"))) as from_address,
		concat('0x', lower(to_hex(t."to"))) as to_address,
		t.amount_usd,
		t.block_time
	from tokens.transfers t
	where t.block_time >= now() - interval '365' day
		and t.amount_usd is not null
		and t.amount_usd > 0
),

bridge_flows as (
	select
		rt.blockchain,
		case
			when lower(coalesce(lfrom.category_name, '')) like '%bridge%' then rt.to_address
			when lower(coalesce(lto.category_name, '')) like '%bridge%' then rt.from_address
			else null
		end as address,
		case
			when lower(coalesce(lfrom.category_name, '')) like '%bridge%' then rt.from_address
			when lower(coalesce(lto.category_name, '')) like '%bridge%' then rt.to_address
			else null
		end as bridge_address,
		case
			when lower(coalesce(lfrom.category_name, '')) like '%bridge%' then coalesce(lfrom.label_name, 'unknown_bridge')
			when lower(coalesce(lto.category_name, '')) like '%bridge%' then coalesce(lto.label_name, 'unknown_bridge')
			else 'unknown_bridge'
		end as bridge_name,
		case
			when lower(coalesce(lfrom.category_name, '')) like '%bridge%' then 1 else 0
		end as inflow_flag,
		case
			when lower(coalesce(lto.category_name, '')) like '%bridge%' then 1 else 0
		end as outflow_flag,
		rt.amount_usd,
		rt.block_time
	from recent_transfers rt
	left join address_labels lfrom
		on rt.blockchain = lfrom.blockchain
	 and rt.from_address = lfrom.address
	left join address_labels lto
		on rt.blockchain = lto.blockchain
	 and rt.to_address = lto.address
	where lower(coalesce(lfrom.category_name, '')) like '%bridge%'
		 or lower(coalesce(lto.category_name, '')) like '%bridge%'
)

select
	bf.blockchain,
	bf.address,
	bf.blockchain as chain,
	bf.bridge_name,
	bf.bridge_address,
	count(*) as tx_count,
	sum(bf.inflow_flag) as inflow_txs,
	sum(bf.outflow_flag) as outflow_txs,
	sum(bf.amount_usd) as total_amount_usd,
	avg(bf.amount_usd) as avg_amount_usd,
	cast(min(bf.block_time) as varchar) as first_seen,
	cast(max(bf.block_time) as varchar) as last_seen,
	date_diff('day', min(bf.block_time), max(bf.block_time)) as activity_span_days
from bridge_flows bf
where bf.address is not null
group by
	bf.blockchain,
	bf.address,
	bf.bridge_name,
	bf.bridge_address
order by total_amount_usd desc
limit 20000;
