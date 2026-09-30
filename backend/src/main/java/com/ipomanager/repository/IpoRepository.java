package com.ipomanager.repository;

import com.ipomanager.model.Ipo;
import com.ipomanager.model.IpoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IpoRepository extends JpaRepository<Ipo, Long> {

    List<Ipo> findByOwnerId(Long ownerId);

    Optional<Ipo> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerIdAndStatus(Long ownerId, IpoStatus status);

    /**
     * Adopts rows created before multi-user auth existed (ownerless) into
     * the first registered account.
     */
    @Modifying
    @Query("update Ipo i set i.ownerId = :ownerId where i.ownerId is null")
    void claimOrphans(@Param("ownerId") Long ownerId);
}
