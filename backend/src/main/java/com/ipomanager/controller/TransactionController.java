package com.ipomanager.controller;

import com.ipomanager.dto.SettleRequest;
import com.ipomanager.dto.TransactionDto;
import com.ipomanager.dto.TransactionRequest;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Ipo;
import com.ipomanager.model.Person;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnDirection;
import com.ipomanager.model.TxnMode;
import com.ipomanager.model.TxnStatus;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.repository.TransactionRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionRepository transactionRepository;
    private final PersonRepository personRepository;
    private final IpoRepository ipoRepository;

    /**
     * Supports the frontend's filters: {@code ipoId}, {@code personId},
     * {@code direction} and {@code pendingOnly} (unsettled RECEIVED txns).
     */
    @GetMapping
    public List<TransactionDto> list(
            @RequestParam(required = false) Long ipoId,
            @RequestParam(required = false) Long personId,
            @RequestParam(required = false) String direction,
            @RequestParam(defaultValue = "false") boolean pendingOnly) {
        return transactionRepository.findAll().stream()
                .filter(t -> ipoId == null || t.getIpo().getId().equals(ipoId))
                .filter(t -> personId == null || t.getPerson().getId().equals(personId))
                .filter(t -> direction == null || direction.isBlank()
                        || t.getDirection().name().equalsIgnoreCase(direction))
                .filter(t -> !pendingOnly
                        || (t.getDirection() == TxnDirection.RECEIVED && !t.isSettled()))
                .map(TransactionDto::from)
                .toList();
    }

    @GetMapping("/{id}")
    public TransactionDto get(@PathVariable Long id) {
        return TransactionDto.from(transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id)));
    }

    @PostMapping
    public ResponseEntity<TransactionDto> create(@Valid @RequestBody TransactionRequest req) {
        Transaction txn = new Transaction();
        apply(req, txn);
        return ResponseEntity.status(201)
                .body(TransactionDto.from(transactionRepository.save(txn)));
    }

    @PutMapping("/{id}")
    public TransactionDto update(@PathVariable Long id,
                                 @Valid @RequestBody TransactionRequest req) {
        Transaction txn = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
        apply(req, txn);
        return TransactionDto.from(transactionRepository.save(txn));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Transaction txn = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
        transactionRepository.delete(txn);
        return ResponseEntity.noContent().build();
    }

    /** Settlement workflow: mark a received transaction as settled (§4.5). */
    @PatchMapping("/{id}/settle")
    public TransactionDto settle(@PathVariable Long id,
                                 @RequestBody(required = false) SettleRequest req) {
        Transaction txn = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
        TxnStatus status = TxnStatus.SETTLED_UNALLOCATED;
        BigDecimal profitLoss = null;
        if (req != null && req.getType() != null
                && req.getType().equalsIgnoreCase("SOLD")) {
            status = TxnStatus.SETTLED_SOLD;
            profitLoss = req.getProfitLoss();
        }
        txn.settleAs(status, profitLoss);
        return TransactionDto.from(transactionRepository.save(txn));
    }

    private void apply(TransactionRequest req, Transaction txn) {
        Person person = personRepository.findById(req.getPersonId())
                .orElseThrow(() -> new ResourceNotFoundException("Person", req.getPersonId()));
        Ipo ipo = ipoRepository.findById(req.getIpoId())
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", req.getIpoId()));
        txn.setPerson(person);
        txn.setIpo(ipo);
        txn.setAmount(req.getAmount());
        TxnDirection direction = parseDirection(req.getDirection());
        txn.setDirection(direction);
        txn.setMode(parseMode(req.getMode()));
        txn.setTxnDate(req.getDate() != null ? req.getDate() : LocalDateTime.now());
        txn.setRemarks(req.getNotes());
        String sender = req.getSender() == null ? null : req.getSender().trim();
        if ((sender == null || sender.isEmpty())
                && direction == TxnDirection.RECEIVED) {
            // Money received almost always comes from the person it is
            // recorded against — default so "who sent whom" is never blank.
            sender = person.getName();
        }
        txn.setSender((sender == null || sender.isEmpty()) ? null : sender);
        String receiver = req.getReceiver() == null ? null : req.getReceiver().trim();
        if ((receiver == null || receiver.isEmpty())
                && direction == TxnDirection.SENT) {
            // Money sent almost always goes to the person it is recorded
            // against — default so "who sent whom" is never blank.
            receiver = person.getName();
        }
        txn.setReceiver((receiver == null || receiver.isEmpty()) ? null : receiver);
        if (req.getStatus() != null && !req.getStatus().isBlank()) {
            txn.setStatus(parseStatus(req.getStatus()));
        } else if (txn.getStatus() == null) {
            txn.setStatus(TxnStatus.SENT);
        }
        // Profit/loss only lives on post-sale settlements; anything else
        // clears a stale value (e.g. status moved back to SENT).
        txn.setProfitLoss(txn.getStatus() == TxnStatus.SETTLED_SOLD
                ? req.getProfitLoss() : null);
    }

    private TxnDirection parseDirection(String value) {
        try {
            return TxnDirection.valueOf(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "direction must be one of: RECEIVED, SENT");
        }
    }

    private TxnMode parseMode(String value) {
        try {
            return TxnMode.valueOf(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "mode must be one of: UPI, GPAY, CASH, BANK, SELF");
        }
    }

    private TxnStatus parseStatus(String value) {
        try {
            return TxnStatus.valueOf(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "status must be one of: SENT, UNALLOCATED, ALLOCATED, "
                            + "SETTLED_UNALLOCATED, SETTLED_SOLD");
        }
    }
}
