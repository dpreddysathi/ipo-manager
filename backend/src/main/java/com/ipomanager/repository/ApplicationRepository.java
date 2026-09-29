package com.ipomanager.repository;

import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByPersonId(Long personId);

    List<Application> findByPersonIdAndIpoId(Long personId, Long ipoId);

    @Query("select coalesce(sum(a.appliedAmount), 0) from Application a "
            + "where a.person.id = :personId and a.ipo.id = :ipoId")
    BigDecimal sumAppliedByPersonAndIpo(@Param("personId") Long personId,
                                        @Param("ipoId") Long ipoId);

    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    long countByStatusAndCreatedAtBetween(ApplicationStatus status,
                                         LocalDateTime from, LocalDateTime to);
}
