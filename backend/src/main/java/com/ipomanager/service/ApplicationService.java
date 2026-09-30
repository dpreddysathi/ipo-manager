package com.ipomanager.service;

import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnStatus;
import com.ipomanager.repository.TransactionRepository;
import com.ipomanager.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Shared application-status transitions. Setting ALLOTTED / NOT_ALLOTTED
 * also stamps who confirmed it and when, and keeps the money lifecycle in
 * sync: open debt legs funding this person's application follow the
 * allotment outcome (spec §9b).
 */
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final TransactionRepository transactionRepository;

    @Transactional
    public void applyStatus(Application app, ApplicationStatus status, String confirmedBy) {
        app.setStatus(status);
        if (status == ApplicationStatus.ALLOTTED || status == ApplicationStatus.NOT_ALLOTTED) {
            app.setAllottedBy(confirmedBy);
            app.setAllottedAt(LocalDateTime.now());
            TxnStatus txnStatus = status == ApplicationStatus.ALLOTTED
                    ? TxnStatus.ALLOCATED : TxnStatus.UNALLOCATED;
            for (Transaction t : transactionRepository.findByOwnerId(
                    AuthContext.currentUserId())) {
                if (t.isSettled() || t.getReturnOf() != null
                        || t.getStatus() != TxnStatus.SENT) {
                    continue;
                }
                if (t.getReceiverPerson() != null
                        && t.getReceiverPerson().getId()
                                .equals(app.getPerson().getId())
                        && t.getIpo().getId().equals(app.getIpo().getId())) {
                    t.setStatus(txnStatus);
                    transactionRepository.save(t);
                }
            }
        }
    }
}
