package com.ipomanager.controller;

import com.ipomanager.dto.ReturnRequest;
import com.ipomanager.dto.TransactionDto;
import com.ipomanager.dto.TransactionRequest;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Application;
import com.ipomanager.model.Ipo;
import com.ipomanager.model.Person;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnMode;
import com.ipomanager.model.TxnStatus;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.repository.TransactionRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.service.Ledger;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionRepository transactionRepository;
    private final PersonRepository personRepository;
    private final IpoRepository ipoRepository;
    private final ApplicationRepository applicationRepository;

    /**
     * Supports the frontend's filters: {@code ipoId}, {@code partyId}
     * (person is either the sender or the receiver) and
     * {@code pendingOnly} (debt legs with money still owed).
     */
    @GetMapping
    public List<TransactionDto> list(
            @RequestParam(required = false) Long ipoId,
            @RequestParam(required = false) Long partyId,
            @RequestParam(defaultValue = "false") boolean pendingOnly) {
        Long userId = AuthContext.currentUserId();
        List<Transaction> all = transactionRepository.findByOwnerId(userId);
        Map<Long, BigDecimal> outstanding = Ledger.outstandingByTxn(all);
        Map<Long, Boolean> struck = Ledger.struckByTxn(all);
        return all.stream()
                .filter(t -> ipoId == null || t.getIpo().getId().equals(ipoId))
                .filter(t -> partyId == null
                        || Objects.equals(idOf(t.getSenderPerson()), partyId)
                        || Objects.equals(idOf(t.getReceiverPerson()), partyId))
                .filter(t -> !pendingOnly
                        || outstanding.getOrDefault(t.getId(),
                                BigDecimal.ZERO).signum() > 0)
                .map(t -> toDto(t, outstanding, struck))
                .toList();
    }

    @GetMapping("/{id}")
    public TransactionDto get(@PathVariable Long id) {
        return toDto(owned(id));
    }

    @PostMapping
    public ResponseEntity<TransactionDto> create(
            @Valid @RequestBody TransactionRequest req) {
        Transaction txn = new Transaction();
        apply(req, txn);
        txn.setOwnerId(AuthContext.currentUserId());
        return ResponseEntity.status(201)
                .body(toDto(transactionRepository.save(txn)));
    }

    @PutMapping("/{id}")
    public TransactionDto update(@PathVariable Long id,
                                 @Valid @RequestBody TransactionRequest req) {
        Transaction txn = owned(id);
        if (txn.getReturnOf() != null) {
            throw new IllegalArgumentException(
                    "Return legs cannot be edited — delete and re-record the return");
        }
        apply(req, txn);
        return toDto(transactionRepository.save(txn));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Transaction txn = owned(id);
        boolean hasReturns = transactionRepository
                .findByOwnerId(AuthContext.currentUserId()).stream()
                .anyMatch(t -> t.getReturnOf() != null
                        && t.getReturnOf().getId().equals(txn.getId()));
        if (hasReturns) {
            throw new IllegalArgumentException(
                    "Delete the return leg first before deleting this transaction");
        }
        if (txn.getReturnOf() != null) {
            // Deleting a return leg re-opens the original: the money is
            // no longer recorded as returned, so the debt is live again.
            // Any P&L this return had posted to applications is reversed.
            Transaction original = txn.getReturnOf();
            BigDecimal postedPnl = original.getProfitLoss();
            original.setStatus(TxnStatus.UNALLOCATED);
            original.setProfitLoss(null);
            transactionRepository.save(original);
            if (postedPnl != null && postedPnl.signum() != 0
                    && original.getReceiverPerson() != null) {
                List<Application> apps = applicationRepository
                        .findByPersonIdAndIpoId(
                                original.getReceiverPerson().getId(),
                                original.getIpo().getId());
                for (Application app : apps) {
                    BigDecimal cur = app.getProfitLoss() == null
                            ? BigDecimal.ZERO : app.getProfitLoss();
                    app.setProfitLoss(cur.subtract(postedPnl));
                    applicationRepository.save(app);
                }
            }
        }
        transactionRepository.delete(txn);
        return ResponseEntity.noContent().build();
    }

    /**
     * One-tap return: records the money moving back to the original
     * sender and settles the original, atomically.
     *
     * <ul>
     *   <li>No {@code profitLoss} — plain return (non-allotted): the exact
     *       amount goes back, original becomes SETTLED_UNALLOCATED.</li>
     *   <li>With {@code profitLoss} — allotted settlement: the sender
     *       receives amount + P&L, original becomes SETTLED_SOLD, and the
     *       P&L is accumulated on the receiver's application for the IPO.</li>
     * </ul>
     */
    @PostMapping("/{id}/return")
    public TransactionDto recordReturn(@PathVariable Long id,
                                       @RequestBody(required = false) ReturnRequest req) {
        Transaction original = owned(id);
        if (original.isSettled()) {
            throw new IllegalArgumentException(
                    "This transaction is already settled");
        }
        if (original.getReturnOf() != null) {
            throw new IllegalArgumentException(
                    "Return legs cannot be returned");
        }
        BigDecimal profitLoss = req == null ? null : req.getProfitLoss();
        BigDecimal returnAmount = profitLoss == null
                ? original.getAmount()
                : original.getAmount().add(profitLoss);
        if (returnAmount == null || returnAmount.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Return amount must be positive — check the profit/loss");
        }

        Transaction leg = new Transaction();
        leg.setOwnerId(AuthContext.currentUserId());
        leg.setSenderPerson(original.getReceiverPerson());
        leg.setSenderName(original.getReceiverName());
        leg.setReceiverPerson(original.getSenderPerson());
        leg.setReceiverName(original.getSenderName());
        leg.setIpo(original.getIpo());
        leg.setAmount(returnAmount);
        leg.setTxnDate(LocalDateTime.now());
        leg.setMode(original.getMode());
        leg.setRemarks("Return of txn #" + original.getId()
                + (profitLoss == null ? ""
                        : " (P&L " + (profitLoss.signum() >= 0 ? "+" : "")
                                + profitLoss.stripTrailingZeros().toPlainString()
                                + ")"));
        leg.setReturnOf(original);
        leg.settleAs(profitLoss == null ? TxnStatus.SETTLED_UNALLOCATED
                : TxnStatus.SETTLED_SOLD, null);
        transactionRepository.save(leg);

        original.settleAs(profitLoss == null ? TxnStatus.SETTLED_UNALLOCATED
                : TxnStatus.SETTLED_SOLD, profitLoss);
        transactionRepository.save(original);

        if (profitLoss != null && original.getReceiverPerson() != null) {
            // The receiver's application realized this P&L.
            List<Application> apps = applicationRepository.findByPersonIdAndIpoId(
                    original.getReceiverPerson().getId(),
                    original.getIpo().getId());
            for (Application app : apps) {
                BigDecimal total = profitLoss.add(app.getProfitLoss() == null
                        ? BigDecimal.ZERO : app.getProfitLoss());
                app.setProfitLoss(total);
                app.setSoldAt(LocalDateTime.now());
                applicationRepository.save(app);
            }
        }
        return toDto(original);
    }

    /** Transaction by id, but only if it belongs to the logged-in user. */
    private Transaction owned(Long id) {
        return transactionRepository.findByIdAndOwnerId(id, AuthContext.currentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
    }

    private void apply(TransactionRequest req, Transaction txn) {
        Long userId = AuthContext.currentUserId();
        Person sender = req.getSenderId() == null ? null
                : personRepository.findByIdAndOwnerId(req.getSenderId(), userId)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Person", req.getSenderId()));
        Person receiver = req.getReceiverId() == null ? null
                : personRepository.findByIdAndOwnerId(req.getReceiverId(), userId)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Person", req.getReceiverId()));
        if (sender == null && receiver == null) {
            throw new IllegalArgumentException(
                    "One side of the movement must be a person");
        }
        Ipo ipo = ipoRepository.findByIdAndOwnerId(req.getIpoId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", req.getIpoId()));
        txn.setSenderPerson(sender);
        txn.setSenderName(sender == null ? Transaction.SELF_NAME : sender.getName());
        txn.setReceiverPerson(receiver);
        txn.setReceiverName(
                receiver == null ? Transaction.SELF_NAME : receiver.getName());
        txn.setIpo(ipo);
        txn.setAmount(req.getAmount());
        txn.setMode(parseMode(req.getMode()));
        txn.setTxnDate(req.getDate() != null ? req.getDate() : LocalDateTime.now());
        txn.setRemarks(req.getNotes());
        if (txn.getStatus() == null) {
            txn.setStatus(TxnStatus.SENT);
        }
    }

    private TransactionDto toDto(Transaction t) {
        Long userId = AuthContext.currentUserId();
        List<Transaction> all = transactionRepository.findByOwnerId(userId);
        return toDto(t, Ledger.outstandingByTxn(all), Ledger.struckByTxn(all));
    }

    private static TransactionDto toDto(Transaction t,
                                        Map<Long, BigDecimal> outstanding,
                                        Map<Long, Boolean> struck) {
        TransactionDto dto = TransactionDto.from(t);
        dto.setOutstanding(outstanding.getOrDefault(t.getId(), BigDecimal.ZERO));
        dto.setStruck(struck.getOrDefault(t.getId(), false));
        return dto;
    }

    private static Long idOf(Person p) {
        return p == null ? null : p.getId();
    }

    private TxnMode parseMode(String value) {
        try {
            return TxnMode.valueOf(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "mode must be one of: UPI, GPAY, CASH, BANK, SELF");
        }
    }
}
