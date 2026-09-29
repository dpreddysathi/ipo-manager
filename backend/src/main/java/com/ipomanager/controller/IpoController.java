package com.ipomanager.controller;

import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Ipo;
import com.ipomanager.repository.IpoRepository;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ipos")
@RequiredArgsConstructor
public class IpoController {

    private final IpoRepository ipoRepository;

    @GetMapping
    public List<Ipo> list() {
        return ipoRepository.findAll();
    }

    @GetMapping("/{id}")
    public Ipo get(@PathVariable Long id) {
        return ipoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", id));
    }

    @PostMapping
    public ResponseEntity<Ipo> create(@Valid @RequestBody Ipo ipo) {
        ipo.setId(null);
        return ResponseEntity.status(201).body(ipoRepository.save(ipo));
    }

    @PutMapping("/{id}")
    public Ipo update(@PathVariable Long id, @Valid @RequestBody Ipo body) {
        Ipo ipo = ipoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", id));
        ipo.setName(body.getName());
        ipo.setOpenDate(body.getOpenDate());
        ipo.setCloseDate(body.getCloseDate());
        ipo.setListingDate(body.getListingDate());
        ipo.setPrice(body.getPrice());
        ipo.setLotSize(body.getLotSize());
        ipo.setStatus(body.getStatus());
        ipo.setNotes(body.getNotes());
        return ipoRepository.save(ipo);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Ipo ipo = ipoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", id));
        ipoRepository.delete(ipo);
        return ResponseEntity.noContent().build();
    }
}
