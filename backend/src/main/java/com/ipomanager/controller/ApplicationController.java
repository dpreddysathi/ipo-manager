package com.ipomanager.controller;

import com.ipomanager.dto.ApplicationDto;
import com.ipomanager.dto.ApplicationRequest;
import com.ipomanager.dto.SaleRequest;
import com.ipomanager.dto.StatusUpdateRequest;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.Ipo;
import com.ipomanager.model.Person;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnDirection;
import com.ipomanager.model.TxnStatus;
import com.ipomanager.repository.ApplicationRepository;
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

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationRepository applicationRepository;
    private final PersonRepository personRepository;
    private final IpoRepository ipoRepository;
    private final TransactionRepository transactionRepository;

    /** Supports the frontend's filters: {@code ipoId} and {@code personId}. */
    @GetMapping
    public List<ApplicationDto> list(
            @RequestParam(required = false) Long ipoId,
            @RequestParam(required = false) Long personId) {
        return applicationRepository.findAll().stream()
                .filter(a -> ipoId == null || a.getIpo().getId().equals(ipoId))
                .filter(a -> personId == null || a.getPerson().getId().equals(personId))
                .map(ApplicationDto::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ApplicationDto get(@PathVariable Long id) {
        return ApplicationDto.from(applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id)));
    }

    @PostMapping
    public ResponseEntity<ApplicationDto> create(@Valid @RequestBody ApplicationRequest req) {
        Application app = new Application();
        apply(req, app);
        if (req.getStatus() != null) {
            setStatus(app, parseStatus(req.getStatus()));
        }
        return ResponseEntity.status(201)
                .body(ApplicationDto.from(applicationRepository.save(app)));
    }

    @PutMapping("/{id}")
    public ApplicationDto update(@PathVariable Long id,
                                 @Valid @RequestBody ApplicationRequest req) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
        apply(req, app);
        if (req.getStatus() != null) {
            setStatus(app, parseStatus(req.getStatus()));
        }
        return ApplicationDto.from(applicationRepository.save(app));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
        applicationRepository.delete(app);
        return ResponseEntity.noContent().build();
    }

    /**
     * Inline status change (§4.2). Setting ALLOTTED / NOT_ALLOTTED also
     * records who confirmed it and when (allottedBy / allottedAt).
     */
    @PatchMapping("/{id}/status")
    public ApplicationDto updateStatus(@PathVariable Long id,
                                       @Valid @RequestBody StatusUpdateRequest req) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
        setStatus(app, parseStatus(req.getStatus()));
        return ApplicationDto.from(applicationRepository.save(app));
    }

    /**
     * Records the sale of allotted shares: the realized profit (positive)
     * or loss (negative) and when the sale happened (defaults to now).
     */
    @PatchMapping("/{id}/sale")
    public ApplicationDto recordSale(@PathVariable Long id,
                                     @RequestBody SaleRequest req) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
        app.setProfitLoss(req.getProfitLoss());
        app.setSoldAt(req.getSoldAt() != null ? req.getSoldAt() : LocalDateTime.now());
        ApplicationDto dto = ApplicationDto.from(applicationRepository.save(app));

        // Smart close-out: money still held for this person + IPO is now
        // settled by the sale. When there is exactly one open RECEIVED
        // transaction the realized P&L is unambiguous, so it is noted on
        // the transaction itself; otherwise the status is settled and the
        // P&L can be split by editing the transactions.
        List<Transaction> open = transactionRepository
                .findByPersonIdAndIpoId(
                        app.getPerson().getId(), app.getIpo().getId())
                .stream()
                .filter(t -> t.getDirection() == TxnDirection.RECEIVED
                        && !t.isSettled())
                .toList();
        for (Transaction t : open) {
            t.settleAs(TxnStatus.SETTLED_SOLD,
                    open.size() == 1 ? req.getProfitLoss() : null);
            transactionRepository.save(t);
        }
        return dto;
    }

    private void setStatus(Application app, ApplicationStatus status) {
        app.setStatus(status);
        if (status == ApplicationStatus.ALLOTTED || status == ApplicationStatus.NOT_ALLOTTED) {
            app.setAllottedBy("You");
            app.setAllottedAt(LocalDateTime.now());
        }
    }

    private void apply(ApplicationRequest req, Application app) {
        Person person = personRepository.findById(req.getPersonId())
                .orElseThrow(() -> new ResourceNotFoundException("Person", req.getPersonId()));
        Ipo ipo = ipoRepository.findById(req.getIpoId())
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", req.getIpoId()));
        app.setPerson(person);
        app.setIpo(ipo);
        app.setLots(req.getLots());
        app.setAppliedAmount(req.getAmount());
        if (req.getAppliedDate() != null) {
            app.setCreatedAt(req.getAppliedDate().atStartOfDay());
        }
        app.setRefundAmount(req.getRefundAmount());
        app.setProfitLoss(req.getProfitLoss());
        app.setRemarks(req.getRemarks());
    }

    private ApplicationStatus parseStatus(String value) {
        try {
            return ApplicationStatus.valueOf(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "status must be one of: APPLIED, ALLOTTED, NOT_ALLOTTED, REFUNDED");
        }
    }
}
