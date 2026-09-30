package com.ipomanager.service;

import com.ipomanager.model.Person;
import com.ipomanager.model.Transaction;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Pure in-memory ledger math over one user's transactions.
 *
 * <p>A transaction is a debt leg ({@code returnOf == null}): the receiver
 * owes the sender the amount. A return leg ({@code returnOf != null}) only
 * ever reduces debt — it never creates it. Within each directed
 * (sender, receiver, IPO) triple, return legs are matched against debt
 * legs oldest-first (FIFO):
 *
 * <pre>
 * outstanding(debt) = settled ? 0 : amount − matched returns
 * struck(debt)      = settled || fully matched
 * </pre>
 *
 * <p>The {@code settled} flag wins because a settlement always moves the
 * full amount back (or amount + P&L); FIFO covers migrated rows whose
 * return was recorded without the flag.
 */
public final class Ledger {

    private Ledger() {
    }

    /** Canonical party key: "ME" for you, "P:&lt;id&gt;" for a person. */
    public static String partyKey(Person person) {
        return person == null ? "ME" : "P:" + person.getId();
    }

    /** Directed triple identifying one debt relationship. */
    public record Triple(String senderKey, String receiverKey, Long ipoId) {
    }

    public static Triple tripleOf(Transaction t) {
        return new Triple(partyKey(t.getSenderPerson()),
                partyKey(t.getReceiverPerson()), t.getIpo().getId());
    }

    /** Per-transaction outstanding amount (zero for settled / return legs). */
    public static Map<Long, BigDecimal> outstandingByTxn(List<Transaction> txns) {
        Map<Triple, List<Transaction>> debts = new HashMap<>();
        Map<Triple, List<Transaction>> returns = new HashMap<>();
        for (Transaction t : txns) {
            Triple triple = tripleOf(t);
            if (t.getReturnOf() != null) {
                // A return leg offsets the reverse triple: it was created
                // R→S against an S→R debt.
                Triple debtTriple = new Triple(triple.receiverKey(),
                        triple.senderKey(), triple.ipoId());
                returns.computeIfAbsent(debtTriple, k -> new ArrayList<>()).add(t);
            } else {
                debts.computeIfAbsent(triple, k -> new ArrayList<>()).add(t);
            }
        }

        Comparator<Transaction> byDate = Comparator
                .comparing(Transaction::getTxnDate,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Transaction::getId);

        Map<Long, BigDecimal> outstanding = new HashMap<>();
        for (Map.Entry<Triple, List<Transaction>> entry : debts.entrySet()) {
            List<Transaction> debtLegs = entry.getValue().stream()
                    .sorted(byDate).toList();
            List<BigDecimal> remaining = returns
                    .getOrDefault(entry.getKey(), List.of()).stream()
                    .sorted(byDate)
                    .map(Transaction::getAmount)
                    .filter(Objects::nonNull)
                    .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

            int ri = 0;
            for (Transaction debt : debtLegs) {
                if (debt.isSettled()) {
                    outstanding.put(debt.getId(), BigDecimal.ZERO);
                    continue;
                }
                BigDecimal need = debt.getAmount() == null
                        ? BigDecimal.ZERO : debt.getAmount();
                BigDecimal matched = BigDecimal.ZERO;
                while (need.signum() > 0 && ri < remaining.size()) {
                    BigDecimal avail = remaining.get(ri);
                    BigDecimal use = avail.min(need);
                    need = need.subtract(use);
                    matched = matched.add(use);
                    remaining.set(ri, avail.subtract(use));
                    if (remaining.get(ri).signum() == 0) {
                        ri++;
                    }
                }
                outstanding.put(debt.getId(), need);
            }
        }
        // Return legs are never owed.
        for (Transaction t : txns) {
            outstanding.putIfAbsent(t.getId(), BigDecimal.ZERO);
        }
        return outstanding;
    }

    /**
     * Which debt legs are struck off: settled, or fully covered by return
     * legs. Return legs themselves are never struck — they are the
     * strike-through action.
     */
    public static Map<Long, Boolean> struckByTxn(List<Transaction> txns) {
        Map<Long, BigDecimal> outstanding = outstandingByTxn(txns);
        Map<Long, Boolean> struck = new HashMap<>();
        for (Transaction t : txns) {
            boolean s = t.getReturnOf() == null
                    && (t.isSettled()
                            || outstanding.getOrDefault(t.getId(),
                                    BigDecimal.ZERO).signum() == 0);
            struck.put(t.getId(), s);
        }
        return struck;
    }

    /**
     * Net outstanding per directed triple: positive means the receiver
     * still owes the sender that much for the IPO.
     */
    public static Map<Triple, BigDecimal> netByTriple(List<Transaction> txns) {
        Map<Long, BigDecimal> outstanding = outstandingByTxn(txns);
        Map<Triple, BigDecimal> net = new HashMap<>();
        for (Transaction t : txns) {
            if (t.getReturnOf() != null) {
                continue;
            }
            BigDecimal o = outstanding.getOrDefault(t.getId(), BigDecimal.ZERO);
            if (o.signum() > 0) {
                net.merge(tripleOf(t), o, BigDecimal::add);
            }
        }
        return net;
    }
}
