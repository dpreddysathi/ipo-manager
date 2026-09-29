package com.ipomanager.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Body for {@code PATCH /api/transactions/{id}/settle}: which kind of
 * settlement closed the money loop.
 *
 * <ul>
 *   <li>{@code UNALLOCATED} (default) — settled because the IPO did not
 *       allot and the money was refunded.</li>
 *   <li>{@code SOLD} — settled after the allotted shares were sold; the
 *       realized profit (+) / loss (−) versus the sent amount travels in
 *       {@code profitLoss}.</li>
 * </ul>
 */
@Getter
@Setter
@NoArgsConstructor
public class SettleRequest {

    private String type;

    private BigDecimal profitLoss;
}
