package com.ipomanager.controller;

import com.ipomanager.dto.AllotmentCheckResult;
import com.ipomanager.dto.RegistrarIpoDto;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.Ipo;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.PersonKycRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.service.AllotmentCheckService;
import com.ipomanager.service.ApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * PAN-based allotment checking against registrar sites.
 *
 * <p>The person's PAN is decrypted from the encrypted KYC store only in
 * memory for the outbound registrar call and never logged or returned.
 */
@RestController
@RequestMapping("/api/allotment")
@RequiredArgsConstructor
public class AllotmentController {

    private final AllotmentCheckService allotmentCheckService;
    private final ApplicationRepository applicationRepository;
    private final PersonKycRepository personKycRepository;
    private final ApplicationService applicationService;

    /** Live IPO list from a registrar (KFINTECH / MUFG), for picking the
     * IPO's registrarRef when setting it up. Cached briefly server-side. */
    @GetMapping("/registrar-ipos")
    public List<RegistrarIpoDto> registrarIpos(
            @RequestParam String registrar) {
        return allotmentCheckService.registrarIpos(registrar);
    }

    /**
     * Checks one application: looks up its person's PAN against the IPO's
     * registrar and records ALLOTTED / NOT_ALLOTTED on the application
     * (with the usual money-lifecycle sync) when the registrar answers
     * decisively.
     */
    @PostMapping("/check")
    public AllotmentCheckResult check(@Valid @RequestBody CheckRequest req) {
        Long userId = AuthContext.currentUserId();
        Application app = applicationRepository
                .findByIdAndOwnerId(req.applicationId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Application", req.applicationId()));
        Ipo ipo = app.getIpo();

        String pan = personKycRepository.findByPersonId(app.getPerson().getId())
                .map(k -> k.getPanNumber())
                .orElse(null);

        AllotmentCheckResult result = allotmentCheckService.check(
                ipo.getRegistrar(), ipo.getRegistrarRef(),
                app.getId(), pan);

        if (result.getOutcome() == AllotmentCheckResult.Outcome.ALLOTTED) {
            applicationService.applyStatus(
                    app, ApplicationStatus.ALLOTTED, "Auto-check");
            applicationRepository.save(app);
        } else if (result.getOutcome() == AllotmentCheckResult.Outcome.NOT_ALLOTTED) {
            applicationService.applyStatus(
                    app, ApplicationStatus.NOT_ALLOTTED, "Auto-check");
            applicationRepository.save(app);
        }
        return result;
    }

    public record CheckRequest(Long applicationId) {
    }
}
