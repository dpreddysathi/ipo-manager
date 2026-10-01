package com.ipomanager.model;

public enum ApplicationStatus {
    APPLIED,
    ALLOTTED,
    NOT_ALLOTTED,
    REFUNDED,
    /** Registrar answered: no application found for the PAN. */
    NOT_FOUND,
    /** Check attempted but the person has no PAN on file. */
    NO_PAN,
    /** The registrar lookup itself failed (network / site error). */
    CHECK_FAILED
}
