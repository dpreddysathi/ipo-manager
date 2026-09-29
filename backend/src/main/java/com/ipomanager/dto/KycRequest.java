package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * KYC upsert payload. Every field is optional — on update, only non-null
 * fields overwrite the stored value (so secrets are never wiped by
 * accident). On create, provided fields are stored.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class KycRequest {

    private String panNumber;
    private String email;
    private String dematBroker;
    private String accountLoginId;
    private String accountPassword;
    private String mpin;
}
