package com.ipomanager.repository;

import com.ipomanager.model.IpoStatus;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnDirection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByPersonId(Long personId);

    List<Transaction> findByPersonIdAndIpoId(Long personId, Long ipoId);

    Optional<Transaction> findFirstByPersonIdAndIpoIdAndDirectionOrderByTxnDateDesc(
            Long personId, Long ipoId, TxnDirection direction);

    Optional<Transaction> findFirstByPersonIdAndIpoIdAndDirectionOrderByTxnDateAsc(
            Long personId, Long ipoId, TxnDirection direction);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t where t.direction = :direction")
    BigDecimal sumByDirection(@Param("direction") TxnDirection direction);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t "
            + "where t.person.id = :personId and t.direction = :direction")
    BigDecimal sumByPersonAndDirection(@Param("personId") Long personId,
                                       @Param("direction") TxnDirection direction);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t "
            + "where t.person.id = :personId and t.ipo.id = :ipoId and t.direction = :direction")
    BigDecimal sumByPersonAndIpoAndDirection(@Param("personId") Long personId,
                                             @Param("ipoId") Long ipoId,
                                             @Param("direction") TxnDirection direction);

    /**
     * Pending settlements: money RECEIVED that was never marked settled,
     * on IPOs that are already resolved (CLOSED / LISTED).
     */
    @Query("select t from Transaction t where t.direction = :direction "
            + "and t.settled = false and t.ipo.status in :statuses")
    List<Transaction> findPendingSettlements(@Param("direction") TxnDirection direction,
                                             @Param("statuses") List<IpoStatus> statuses);
}
