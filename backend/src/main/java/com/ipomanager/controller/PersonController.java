package com.ipomanager.controller;

import com.ipomanager.dto.KycRequest;
import com.ipomanager.dto.KycResponse;
import com.ipomanager.dto.PersonReportDto;
import com.ipomanager.dto.ReportFilter;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Person;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.service.KycService;
import com.ipomanager.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/people")
@RequiredArgsConstructor
public class PersonController {

    private final PersonRepository personRepository;
    private final KycService kycService;
    private final ReportService reportService;

    @GetMapping
    public List<Person> list() {
        return personRepository.findByOwnerId(AuthContext.currentUserId());
    }

    @GetMapping("/{id}")
    public Person get(@PathVariable Long id) {
        return owned(id);
    }

    @PostMapping
    public ResponseEntity<Person> create(@Valid @RequestBody Person person) {
        person.setId(null);
        person.setOwnerId(AuthContext.currentUserId());
        return ResponseEntity.status(201).body(personRepository.save(person));
    }

    @PutMapping("/{id}")
    public Person update(@PathVariable Long id, @Valid @RequestBody Person body) {
        Person person = owned(id);
        person.setName(body.getName());
        person.setPhone(body.getPhone());
        // Only overwrite circle when the caller actually sent one — the
        // frontend's PersonInput has no circle field, so a blind set would
        // wipe it on every edit.
        if (body.getCircle() != null) {
            person.setCircle(body.getCircle());
        }
        person.setNotes(body.getNotes());
        return personRepository.save(person);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        personRepository.delete(owned(id));
        return ResponseEntity.noContent().build();
    }

    /** Person by id, but only if it belongs to the logged-in user. */
    private Person owned(Long id) {
        return personRepository.findByIdAndOwnerId(id, AuthContext.currentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Person", id));
    }

    // ---- KYC (masked by default, per spec §6) ----

    @GetMapping("/{id}/kyc")
    public KycResponse getKyc(@PathVariable Long id,
                              @RequestParam(defaultValue = "false") boolean reveal) {
        return kycService.getKyc(id, reveal);
    }

    @PutMapping("/{id}/kyc")
    public KycResponse upsertKyc(@PathVariable Long id,
                                 @RequestBody KycRequest request) {
        return kycService.upsert(id, request);
    }

    // ---- Report (data behind the Person Report Drawer) ----

    @GetMapping("/{id}/report")
    public PersonReportDto report(@PathVariable Long id,
                                  @RequestParam(required = false) Long ipoId,
                                  @RequestParam(required = false) Boolean includeSettled,
                                  @RequestParam(required = false) Boolean onlyUnallotted,
                                  @RequestParam(required = false)
                                  @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                                  @RequestParam(required = false)
                                  @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        ReportFilter filter = new ReportFilter();
        if (includeSettled != null) {
            filter.setIncludeSettled(includeSettled);
        }
        if (onlyUnallotted != null) {
            filter.setOnlyUnallotted(onlyUnallotted);
        }
        filter.setFromDate(fromDate);
        filter.setToDate(toDate);
        return reportService.buildReport(id, ipoId, filter);
    }
}
