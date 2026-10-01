package com.ipomanager.controller;

import com.ipomanager.dto.AllotmentCheckResult;
import com.ipomanager.dto.RegistrarDetection;
import com.ipomanager.dto.RegistrarIpoDto;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.Ipo;
import com.ipomanager.model.Person;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonKycRepository;
import com.ipomanager.repository.PersonRepository;
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
    private final IpoRepository ipoRepository;
    private final PersonRepository personRepository;
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
     * Works out the IPO's registrar without asking the user: fuzzy-matches
     * the IPO name against the live KFintech / MUFG Intime catalogues and
     * saves a confident match on the IPO. When nothing matches confidently
     * the response has a null registrar and the UI falls back to manual
     * setup.
     */
    @PostMapping("/detect")
    public RegistrarDetection detect(@Valid @RequestBody DetectRequest req) {
        Long userId = AuthContext.currentUserId();
        Ipo ipo = ipoRepository.findByIdAndOwnerId(req.ipoId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Ipo", req.ipoId()));

        if (ipo.getRegistrar() != null && ipo.getRegistrarRef() != null
                && allotmentCheckService.supportsAutoCheck(
                        ipo.getRegistrar())) {
            return new RegistrarDetection(ipo.getRegistrar(),
                    ipo.getRegistrarRef(), null, 1.0,
                    "Registrar already set — kept as is.");
        }

        return allotmentCheckService.detectRegistrar(ipo.getName())
                .map(hit -> {
                    ipo.setRegistrar(hit.getRegistrar());
                    ipo.setRegistrarRef(hit.getRegistrarRef());
                    ipoRepository.save(ipo);
                    hit.setMessage(
                            "Matched automatically — change it if this looks wrong.");
                    return hit;
                })
                .orElseGet(() -> {
                    RegistrarDetection miss = new RegistrarDetection();
                    miss.setMessage(
                            "Couldn't confidently match this IPO on KFintech "
                            + "or MUFG Intime — set the registrar manually.");
                    return miss;
                });
    }

    /**
     * Checks one person against one IPO: looks up their PAN on the IPO's
     * registrar. When the person has an application for this IPO and the
     * registrar answers decisively, the application is updated to
     * ALLOTTED / NOT_ALLOTTED (with the usual money-lifecycle sync).
     * People without an application just get the registrar's answer shown.
     */
    @PostMapping("/check")
    public AllotmentCheckResult check(@Valid @RequestBody CheckRequest req) {
        Long userId = AuthContext.currentUserId();
        Ipo ipo = ipoRepository.findByIdAndOwnerId(req.ipoId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Ipo", req.ipoId()));
        Person person = personRepository
                .findByIdAndOwnerId(req.personId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Person", req.personId()));

        String pan = personKycRepository.findByPersonId(person.getId())
                .map(k -> k.getPanNumber())
                .orElse(null);

        AllotmentCheckResult result = allotmentCheckService.check(
                ipo.getRegistrar(), ipo.getRegistrarRef(),
                null, pan);
        result.setPersonId(person.getId());

        applicationRepository
                .findByPersonIdAndIpoId(person.getId(), ipo.getId())
                .stream().findFirst().ifPresent(app -> {
                    result.setApplicationId(app.getId());
                    if (result.getOutcome()
                            == AllotmentCheckResult.Outcome.ALLOTTED) {
                        applicationService.applyStatus(app,
                                ApplicationStatus.ALLOTTED, "Auto-check");
                        applicationRepository.save(app);
                    } else if (result.getOutcome()
                            == AllotmentCheckResult.Outcome.NOT_ALLOTTED) {
                        applicationService.applyStatus(app,
                                ApplicationStatus.NOT_ALLOTTED, "Auto-check");
                        applicationRepository.save(app);
                    }
                });
        return result;
    }

    public record CheckRequest(Long ipoId, Long personId) {
    }

    public record DetectRequest(Long ipoId) {
    }
}
