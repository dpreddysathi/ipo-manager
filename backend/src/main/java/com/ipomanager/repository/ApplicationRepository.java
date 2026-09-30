package com.ipomanager.repository;

import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByOwnerId(Long ownerId);

    Optional<Application> findByIdAndOwnerId(Long id, Long ownerId);

    List<Application> findByPersonId(Long personId);

    List<Application> findByPersonIdAndIpoId(Long personId, Long ipoId);

    @Query("select coalesce(sum(a.appliedAmount), 0) from Application a "
            + "where a.person.id = :personId and a.ipo.id = :ipoId")
    BigDecimal sumAppliedByPersonAndIpo(@Param("personId") Long personId,
                                        @Param("ipoId") Long ipoId);

    long countByOwnerIdAndCreatedAtBetween(Long ownerId,
                                          LocalDateTime from, LocalDateTime to);

    long countByOwnerIdAndStatusAndCreatedAtBetween(Long ownerId,
                                                   ApplicationStatus status,
                                                   LocalDateTime from, LocalDateTime to);

    /**
     * Adopts rows created before multi-user auth existed (ownerless) into
     * the first registered account.
     */
    @Modifying
    @Query("update Application a set a.ownerId = :ownerId where a.ownerId is null")
    void claimOrphans(@Param("ownerId") Long ownerId);
}
