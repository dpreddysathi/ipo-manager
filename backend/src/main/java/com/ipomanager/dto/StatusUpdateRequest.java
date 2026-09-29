package com.ipomanager.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class StatusUpdateRequest {

    @NotNull(message = "status is required")
    private String status; // APPLIED | ALLOTTED | NOT_ALLOTTED | REFUNDED
}
