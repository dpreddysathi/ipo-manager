package com.ipomanager.controller;

import com.ipomanager.dto.IpoSummaryDto;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Ipo;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.service.IpoSyncService;
import com.ipomanager.service.ReportService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ipos")
@RequiredArgsConstructor
public class IpoController {

    private final IpoRepository ipoRepository;
    private final ReportService reportService;
    private final IpoSyncService ipoSyncService;

    @GetMapping
    public List<Ipo> list() {
        return ipoRepository.findByOwnerId(AuthContext.currentUserId());
    }

    @GetMapping("/{id}")
    public Ipo get(@PathVariable Long id) {
        return owned(id);
    }

    /**
     * The complete picture of one IPO: applications with their funders,
     * allotment counts, every money movement, and who still owes whom.
     */
    @GetMapping("/{id}/summary")
    public IpoSummaryDto summary(@PathVariable Long id) {
        return reportService.summary(id);
    }

    @PostMapping
    public ResponseEntity<Ipo> create(@Valid @RequestBody Ipo ipo) {
        ipo.setId(null);
        ipo.setOwnerId(AuthContext.currentUserId());
        return ResponseEntity.status(201).body(ipoRepository.save(ipo));
    }

    @PutMapping("/{id}")
    public Ipo update(@PathVariable Long id, @Valid @RequestBody Ipo body) {
        Ipo ipo = owned(id);
        ipo.setName(body.getName());
        ipo.setOpenDate(body.getOpenDate());
        ipo.setCloseDate(body.getCloseDate());
        ipo.setListingDate(body.getListingDate());
        ipo.setPrice(body.getPrice());
        ipo.setLotSize(body.getLotSize());
        ipo.setStatus(body.getStatus());
        ipo.setNotes(body.getNotes());
        ipo.setRegistrar(body.getRegistrar());
        ipo.setRegistrarRef(body.getRegistrarRef());
        return ipoRepository.save(ipo);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ipoRepository.delete(owned(id));
        return ResponseEntity.noContent().build();
    }

    /**
     * Pull the latest mainboard IPOs from Chittorgarh now (the same sync that
     * runs at startup and daily at 06:30 IST). The fast feed pass runs
     * synchronously; detail enrichment continues in the background.
     * Returns what changed: added / updated / hidden.
     */
    @PostMapping("/sync")
    public IpoSyncService.SyncSummary syncNow() {
        IpoSyncService.SyncSummary s = ipoSyncService.syncFeed();
        ipoSyncService.submitEnrichment();
        return s;
    }

    /**
     * Board visibility + triage decision. {@code hidden:true} removes from the
     * board (row stays in the DB and remains searchable); {@code decision} is
     * APPLY or AVOID. Either key may be omitted.
     */
    @PatchMapping("/{id}/board")
    public Ipo setBoard(@PathVariable Long id, @RequestBody BoardUpdate body) {
        Ipo ipo = owned(id);
        if (body.hidden() != null) {
            ipo.setBoardHidden(body.hidden());
        }
        if ("APPLY".equals(body.decision()) || "AVOID".equals(body.decision())) {
            ipo.setDecision(body.decision());
        }
        return ipoRepository.save(ipo);
    }

    public record BoardUpdate(Boolean hidden, String decision) {
    }

    /** IPO by id, but only if it belongs to the logged-in user. */
    private Ipo owned(Long id) {
        return ipoRepository.findByIdAndOwnerId(id, AuthContext.currentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", id));
    }
}
