package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Best-guess registrar match for one of the user's IPOs.
 * Produced by fuzzy-matching the IPO name against the live KFintech and
 * MUFG Intime catalogues — the user just taps the IPO, no manual setup.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegistrarDetection {

    /**
     * KFINTECH or MUFG when a catalogue entry matched confidently,
     * otherwise null (BSE/Bigshare/manual have no listable catalogue).
     */
    private String registrar;

    /** The IPO's key on the registrar's site (clientId / company_id). */
    private String registrarRef;

    /** The registrar's own display name for the matched entry. */
    private String registrarName;

    /**
     * 0..1 match confidence. 1.0 means the IPO already had a registrar
     * saved and detection simply confirmed it.
     */
    private double confidence;

    /** Human note, e.g. why detection failed or needs a manual check. */
    private String message;
}
