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
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.service.ApplicationService;
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
    private final ApplicationService applicationService;

    /** Supports the frontend's filters: {@code ipoId} and {@code personId}. */
    @GetMapping
    public List<ApplicationDto> list(
            @RequestParam(required = false) Long ipoId,
            @RequestParam(required = false) Long personId) {
        return applicationRepository.findByOwnerId(AuthContext.currentUserId()).stream()
                .filter(a -> ipoId == null || a.getIpo().getId().equals(ipoId))
                .filter(a -> personId == null || a.getPerson().getId().equals(personId))
                .map(ApplicationDto::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ApplicationDto get(@PathVariable Long id) {
        return ApplicationDto.from(owned(id));
    }

    @PostMapping
    public ResponseEntity<ApplicationDto> create(@Valid @RequestBody ApplicationRequest req) {
        Long userId = AuthContext.currentUserId();
        if (!applicationRepository
                .findByPersonIdAndIpoId(req.getPersonId(), req.getIpoId()).isEmpty()) {
            throw new IllegalArgumentException(
                    "This person already has an application for this IPO");
        }
        Application app = new Application();
        apply(req, app);
        app.setOwnerId(userId);
        if (req.getStatus() != null) {
            setStatus(app, parseStatus(req.getStatus()));
        }
        return ResponseEntity.status(201)
                .body(ApplicationDto.from(applicationRepository.save(app)));
    }

    @PutMapping("/{id}")
    public ApplicationDto update(@PathVariable Long id,
                                 @Valid @RequestBody ApplicationRequest req) {
        Application app = owned(id);
        apply(req, app);
        if (req.getStatus() != null) {
            setStatus(app, parseStatus(req.getStatus()));
        }
        return ApplicationDto.from(applicationRepository.save(app));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        applicationRepository.delete(owned(id));
        return ResponseEntity.noContent().build();
    }

    /** Application by id, but only if it belongs to the logged-in user. */
    private Application owned(Long id) {
        return applicationRepository.findByIdAndOwnerId(id, AuthContext.currentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
    }

    /**
     * Inline status change (§4.2). Setting ALLOTTED / NOT_ALLOTTED also
     * records who confirmed it and when (allottedBy / allottedAt).
     */
    @PatchMapping("/{id}/status")
    public ApplicationDto updateStatus(@PathVariable Long id,
                                       @Valid @RequestBody StatusUpdateRequest req) {
        Application app = owned(id);
        setStatus(app, parseStatus(req.getStatus()));
        return ApplicationDto.from(applicationRepository.save(app));
    }

    /**
     * Records the sale of allotted shares: the realized profit (positive)
     * or loss (negative) and when the sale happened (defaults to now).
     *
     * <p>This is pure P&L bookkeeping — it does not move money. The debt
     * is cleared only when the return is recorded via
     * {@code POST /api/transactions/{id}/return}, which also accumulates
     * the P&L here automatically.
     */
    @PatchMapping("/{id}/sale")
    public ApplicationDto recordSale(@PathVariable Long id,
                                     @RequestBody SaleRequest req) {
        Application app = owned(id);
        app.setProfitLoss(req.getProfitLoss());
        app.setSoldAt(req.getSoldAt() != null ? req.getSoldAt() : LocalDateTime.now());
        return ApplicationDto.from(applicationRepository.save(app));
    }

    private void setStatus(Application app, ApplicationStatus status) {
        applicationService.applyStatus(app, status, "You");
    }

    private void apply(ApplicationRequest req, Application app) {
        Long userId = AuthContext.currentUserId();
        Person person = personRepository.findByIdAndOwnerId(req.getPersonId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", req.getPersonId()));
        Ipo ipo = ipoRepository.findByIdAndOwnerId(req.getIpoId(), userId)
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
