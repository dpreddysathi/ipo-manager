package com.ipomanager.repository;

import com.ipomanager.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByOwnerId(Long ownerId);

    Optional<Transaction> findByIdAndOwnerId(Long id, Long ownerId);

    /**
     * Every money movement where the person is either the sender or the
     * receiver, for one user.
     */
    @Query("select t from Transaction t where t.ownerId = :ownerId "
            + "and (t.senderPerson.id = :personId or t.receiverPerson.id = :personId)")
    List<Transaction> findInvolvingPerson(@Param("ownerId") Long ownerId,
                                          @Param("personId") Long personId);

    @Query("select t from Transaction t where t.ownerId = :ownerId "
            + "and t.ipo.id = :ipoId")
    List<Transaction> findByIpo(@Param("ownerId") Long ownerId,
                                @Param("ipoId") Long ipoId);

    /**
     * Adopts rows created before multi-user auth existed (ownerless) into
     * the first registered account.
     */
    @Modifying
    @Query("update Transaction t set t.ownerId = :ownerId where t.ownerId is null")
    void claimOrphans(@Param("ownerId") Long ownerId);
}
