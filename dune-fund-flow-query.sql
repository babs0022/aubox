-- DUNE QUERY: FUND FLOW TRACE
-- Expected query parameters:
--   {{wallet_address}}  (string, required, 0x...)
--   {{start_timestamp}} (number, required, unix seconds)
--   {{tx_hash}}         (string, optional, 0x... or empty)
--
-- Output columns required by backend:
--   blockchain, from_address, to_address, protocol_name, protocol_type,
--   amount, amount_usd, tx_count, outgoing_txs, incoming_txs,
--   first_activity, last_activity, tx_hashes, hop_level, flow_direction

with params as (
	select
		lower(trim('{{wallet_address}}')) as wallet_address,
		from_unixtime(cast({{start_timestamp}} as bigint)) as start_time,
		lower(trim(coalesce('{{tx_hash}}', ''))) as tx_hash
),

seed_transfers as (
	select
		t.blockchain,
		concat('0x', lower(to_hex(t."from"))) as from_address,
		concat('0x', lower(to_hex(t."to"))) as to_address,
		t.amount as amount,
		coalesce(t.amount_usd, 0) as amount_usd,
		t.tx_hash,
		t.block_time,
		case
			when concat('0x', lower(to_hex(t."from"))) = p.wallet_address then 'outgoing'
			when concat('0x', lower(to_hex(t."to"))) = p.wallet_address then 'incoming'
			else 'outgoing'
		end as flow_direction
	from tokens.transfers t
	cross join params p
	where t.block_time >= p.start_time
		and (
			concat('0x', lower(to_hex(t."from"))) = p.wallet_address
			or concat('0x', lower(to_hex(t."to"))) = p.wallet_address
		)
		and (
			p.tx_hash = ''
			or concat('0x', lower(to_hex(t.tx_hash))) = p.tx_hash
		)
		and t.amount_usd is not null
),

address_labels as (
	select
		lower(blockchain) as blockchain,
		concat('0x', lower(to_hex(address))) as address,
		max_by(name, updated_at) as label_name,
		max_by(category, updated_at) as category_name
	from labels.addresses
	group by 1, 2
)

select
	st.blockchain,
	st.from_address,
	st.to_address,
	coalesce(lto.label_name, lfrom.label_name, 'Unknown') as protocol_name,
	coalesce(lower(lto.category_name), lower(lfrom.category_name), 'unknown') as protocol_type,
	sum(st.amount) as amount,
	sum(st.amount_usd) as amount_usd,
	count(*) as tx_count,
	sum(case when st.flow_direction = 'outgoing' then 1 else 0 end) as outgoing_txs,
	sum(case when st.flow_direction = 'incoming' then 1 else 0 end) as incoming_txs,
	cast(min(st.block_time) as varchar) as first_activity,
	cast(max(st.block_time) as varchar) as last_activity,
	array_join(array_agg(distinct concat('0x', lower(to_hex(st.tx_hash)))), ',') as tx_hashes,
	1 as hop_level,
	st.flow_direction as flow_direction
from seed_transfers st
left join address_labels lto
	on lower(st.blockchain) = lto.blockchain
 and st.to_address = lto.address
left join address_labels lfrom
	on lower(st.blockchain) = lfrom.blockchain
 and st.from_address = lfrom.address
group by
	st.blockchain,
	st.from_address,
	st.to_address,
	coalesce(lto.label_name, lfrom.label_name, 'Unknown'),
	coalesce(lower(lto.category_name), lower(lfrom.category_name), 'unknown'),
	st.flow_direction
order by amount_usd desc
limit 5000;
