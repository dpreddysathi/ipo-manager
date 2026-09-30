package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One IPO as listed by a registrar's own site (for picking registrarRef). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegistrarIpoDto {
    /** The registrar's company key (KFintech clientId, MUFG company_id). */
    private String id;
    /** The exact name the registrar lists it under. */
    private String name;
}
