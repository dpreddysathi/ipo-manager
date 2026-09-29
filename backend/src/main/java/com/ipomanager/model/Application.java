package com.ipomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "applications")
@Getter
@Setter
@NoArgsConstructor
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "person_id")
    private Person person;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "ipo_id")
    private Ipo ipo;

    @Min(value = 1, message = "lots must be at least 1")
    private Integer lots;

    @Column(precision = 19, scale = 2)
    private BigDecimal appliedAmount;

    @Enumerated(EnumType.STRING)
    private ApplicationStatus status;

    @Column(precision = 19, scale = 2)
    private BigDecimal refundAmount;

    @Column(precision = 19, scale = 2)
    private BigDecimal profitLoss;

    @Column(length = 1000)
    private String remarks;

    /** Who confirmed the allotment outcome ("You" for this single-user app). */
    private String allottedBy;

    /** When the status was last changed to ALLOTTED / NOT_ALLOTTED. */
    private LocalDateTime allottedAt;

    /** When the allotted shares were sold (set when profit/loss is recorded). */
    private LocalDateTime soldAt;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = ApplicationStatus.APPLIED;
        }
    }
}
