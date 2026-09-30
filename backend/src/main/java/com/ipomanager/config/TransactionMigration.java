package com.ipomanager.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One-time migration from the old transaction model
 * ({@code person_id} + {@code direction} + free-text sender/receiver) to
 * the person-to-person model ({@code sender_person_id} /
 * {@code receiver_person_id}, either side nullable = you).
 *
 * <p>Mapping:
 * <ul>
 *   <li>old RECEIVED (person → you) becomes a debt leg:
 *       sender = person, receiver = you ("Me").</li>
 *   <li>old SENT (you → person) was always money sent back, so it becomes
 *       a return leg: sender = you ("Me"), receiver = person, linked via
 *       {@code return_of_id} to the earliest open RECEIVED leg of the same
 *       person + IPO (FIFO), and marked settled.</li>
 *   <li>old RECEIVED legs fully covered by linked returns are marked
 *       settled so "yet to pay" is correct from day one. When the total
 *       returned exceeds the original, the surplus is inferred as
 *       profit/loss on a post-sale settlement.</li>
 * </ul>
 *
 * <p>Idempotent: only touches rows that still have the old
 * {@code person_id} set and no new party columns.
 */
@Component
@RequiredArgsConstructor
public class TransactionMigration implements ApplicationRunner {

    private static final String ME = "Me";

    private final JdbcTemplate jdbc;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!legacyColumnsPresent()) {
            return; // fresh database: nothing to migrate
        }
        // Databases created before the rewrite still carry the old columns
        // (person_id, direction, ...) as NOT NULL, and Hibernate's
        // ddl-auto=update never drops or relaxes them — so every new insert
        // fails. Relax them first; the data itself is migrated below.
        relaxLegacyColumns();
        List<OldTxn> rows = jdbc.query(
                "select t.id, t.person_id, t.direction, t.sender, t.receiver,"
                        + " t.settled, t.status, t.ipo_id, t.amount,"
                        + " p.name as person_name"
                        + " from transactions t join people p on p.id = t.person_id"
                        + " where t.person_id is not null"
                        + " and t.sender_person_id is null"
                        + " and t.receiver_person_id is null"
                        + " order by t.id",
                (rs, n) -> new OldTxn(
                        rs.getLong("id"),
                        rs.getLong("person_id"),
                        rs.getString("direction"),
                        rs.getString("sender"),
                        rs.getString("receiver"),
                        rs.getBoolean("settled"),
                        rs.getString("status"),
                        rs.getLong("ipo_id"),
                        rs.getBigDecimal("amount"),
                        rs.getString("person_name")));
        if (rows.isEmpty()) {
            return;
        }

        Map<String, List<OldTxn>> receivedByKey = new LinkedHashMap<>();
        List<OldTxn> sent = new ArrayList<>();
        for (OldTxn row : rows) {
            if ("RECEIVED".equalsIgnoreCase(row.direction())) {
                receivedByKey
                        .computeIfAbsent(key(row), k -> new ArrayList<>())
                        .add(row);
                String senderName = blank(row.sender())
                        ? row.personName() : row.sender().trim();
                jdbc.update("update transactions set sender_person_id = ?,"
                        + " sender_name = ?, receiver_name = ? where id = ?",
                        row.personId(), senderName, ME, row.id());
            } else {
                sent.add(row);
                String receiverName = blank(row.receiver())
                        ? row.personName() : row.receiver().trim();
                jdbc.update("update transactions set receiver_person_id = ?,"
                        + " sender_name = ?, receiver_name = ? where id = ?",
                        row.personId(), ME, receiverName, row.id());
            }
        }

        // FIFO-link every old SENT as a return leg of the earliest open
        // RECEIVED leg for the same person + IPO.
        Map<Long, BigDecimal> remaining = new LinkedHashMap<>();
        Map<Long, BigDecimal> returnedTotal = new LinkedHashMap<>();
        for (OldTxn s : sent) {
            List<OldTxn> candidates = receivedByKey
                    .getOrDefault(key(s), List.of());
            BigDecimal need = s.amount() == null ? BigDecimal.ZERO : s.amount();
            Long linkedId = null;
            for (OldTxn r : candidates) {
                BigDecimal rem = remaining.computeIfAbsent(r.id(),
                        k -> r.amount() == null ? BigDecimal.ZERO : r.amount());
                if (rem.signum() <= 0) {
                    continue;
                }
                if (linkedId == null) {
                    linkedId = r.id();
                }
                BigDecimal use = rem.min(need);
                remaining.put(r.id(), rem.subtract(use));
                returnedTotal.merge(r.id(), use, BigDecimal::add);
                need = need.subtract(use);
                if (need.signum() == 0) {
                    break;
                }
            }
            if (linkedId != null) {
                jdbc.update("update transactions set return_of_id = ?,"
                        + " settled = true,"
                        + " settled_at = coalesce(settled_at, current_timestamp),"
                        + " status = case when status = 'SENT'"
                        + " then 'SETTLED_UNALLOCATED' else status end"
                        + " where id = ?", linkedId, s.id());
            }
        }

        // Fully covered RECEIVED legs are settled — struck off everywhere.
        for (List<OldTxn> group : receivedByKey.values()) {
            for (OldTxn r : group) {
                BigDecimal rem = remaining.getOrDefault(r.id(),
                        r.amount() == null ? BigDecimal.ZERO : r.amount());
                BigDecimal total = returnedTotal.getOrDefault(r.id(),
                        BigDecimal.ZERO);
                if (rem.signum() == 0 && !r.settled()
                        && r.amount() != null && r.amount().signum() > 0) {
                    BigDecimal surplus = total.subtract(r.amount());
                    if (surplus.signum() > 0) {
                        jdbc.update("update transactions set settled = true,"
                                + " settled_at = current_timestamp,"
                                + " status = 'SETTLED_SOLD', profit_loss = ?"
                                + " where id = ?", surplus, r.id());
                    } else {
                        jdbc.update("update transactions set settled = true,"
                                + " settled_at = current_timestamp,"
                                + " status = case when status in ('SENT','UNALLOCATED')"
                                + " then 'SETTLED_UNALLOCATED' else status end"
                                + " where id = ?", r.id());
                    }
                }
            }
        }
    }

    /**
     * Drops the NOT NULL constraint from leftover pre-rewrite columns so
     * new rows can be inserted. Runs on every startup while the legacy
     * columns exist, and is a no-op once they are already nullable.
     */
    private void relaxLegacyColumns() {
        List<String> notNull = jdbc.queryForList(
                "select column_name from information_schema.columns"
                        + " where table_name = 'TRANSACTIONS'"
                        + " and column_name in"
                        + " ('PERSON_ID','DIRECTION','SENDER','RECEIVER')"
                        + " and is_nullable = 'NO'",
                String.class);
        for (String col : notNull) {
            // Column name comes from the database metadata, not user input.
            jdbc.execute("alter table transactions alter column " + col
                    + " drop not null");
        }
    }

    /**
     * True when this database still has the old transaction columns
     * ({@code person_id}, {@code direction}, ...). Fresh databases are
     * created by Hibernate with only the new schema, so there is nothing
     * to migrate.
     */
    private boolean legacyColumnsPresent() {
        Integer n = jdbc.queryForObject(
                "select count(*) from information_schema.columns"
                        + " where table_name = 'TRANSACTIONS'"
                        + " and column_name = 'PERSON_ID'",
                Integer.class);
        return n != null && n > 0;
    }

    private static String key(OldTxn t) {
        return t.personId() + ":" + t.ipoId();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private record OldTxn(Long id, Long personId, String direction,
                          String sender, String receiver, boolean settled,
                          String status, Long ipoId, BigDecimal amount,
                          String personName) {
    }
}
