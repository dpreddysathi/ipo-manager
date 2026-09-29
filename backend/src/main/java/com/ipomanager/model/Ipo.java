package com.ipomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "ipos")
@Getter
@Setter
@NoArgsConstructor
public class Ipo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "name is required")
    private String name;

    private LocalDate openDate;

    private LocalDate closeDate;

    @Enumerated(EnumType.STRING)
    private IpoStatus status;

    private LocalDate listingDate;

    @Column(precision = 19, scale = 2)
    private BigDecimal price;

    private Integer lotSize;

    @Column(length = 2000)
    private String notes;
}
