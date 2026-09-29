package com.ipomanager.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Audit trail of reports sent to people (so you can answer
 * "did I actually send Rahul his Tata Capital report?").
 */
@Entity
@Table(name = "report_logs")
@Getter
@Setter
@NoArgsConstructor
public class ReportLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "person_id")
    private Person person;

    /** Nullable — null means an "all IPOs" report. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ipo_id")
    private Ipo ipo;

    /** sms | whatsapp */
    private String channel;

    private String sentTo;

    private LocalDateTime sentAt;

    /** sent | failed | manual (user taps through to WhatsApp themselves) */
    private String status;
}
