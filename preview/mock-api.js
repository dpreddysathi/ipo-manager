/* Preview-only mock backend for the IPO Manager mobile UI preview.
 * Intercepts window.fetch for /api/** and serves an in-memory dataset,
 * so the REAL built frontend bundle runs unmodified (auth + all CRUD).
 * Implements the person-to-person ledger faithfully:
 *   - every transaction has senderId/receiverId (null = "Me")
 *   - the receiver owes the sender; returns point back via returnOfId
 *   - FIFO matching of return legs against debt legs per
 *     (sender, receiver, IPO) triple
 *   - POST /api/transactions/{id}/return = one-tap return + strike-off
 * Everything else passes through to the real fetch. */
(function () {
  'use strict';
  var realFetch = window.fetch.bind(window);

  /* ---------------- seed data ---------------- */
  var seq = { ipo: 4, person: 5, txn: 9, app: 6 };
  var ipos = [
    { id: 1, name: 'Shree Ganesh Agro Ltd', status: 'OPEN', openDate: '2026-09-22', closeDate: '2026-09-26', listingDate: null, price: 150, lotSize: 100, notes: 'Mainboard · strong subscription' },
    { id: 2, name: 'NovaTech Systems Ltd', status: 'LISTED', openDate: '2026-08-10', closeDate: '2026-08-13', listingDate: '2026-08-25', price: 320, lotSize: 45, notes: null },
    { id: 3, name: 'Brightline Foods Ltd', status: 'UPCOMING', openDate: '2026-10-06', closeDate: '2026-10-09', listingDate: null, price: 95, lotSize: 150, notes: 'SME' },
  ];
  var people = [
    { id: 1, name: 'Ganesh Kumar', phone: '+91 98765 43210', notes: null, createdAt: '2026-08-01T10:00:00' },
    { id: 2, name: 'Priya Sharma', phone: '+91 98111 22334', notes: null, createdAt: '2026-08-02T10:00:00' },
    { id: 3, name: 'Rahul Verma', phone: '+91 99000 11223', notes: null, createdAt: '2026-08-03T10:00:00' },
    { id: 4, name: 'Sneha Iyer', phone: '+91 97654 32109', notes: null, createdAt: '2026-08-04T10:00:00' },
  ];
  // senderId / receiverId: null = Me. returnOfId points at the original leg.
  var txns = [
    { id: 1, senderId: 1, receiverId: null, ipoId: 1, amount: 15000, mode: 'UPI', date: '2026-09-23T10:30:00', notes: 'Ganesh funded my application', status: 'ALLOCATED', profitLoss: null, settled: false, settledAt: null, returnOfId: null },
    { id: 2, senderId: null, receiverId: 2, ipoId: 1, amount: 15000, mode: 'UPI', date: '2026-09-23T11:05:00', notes: null, status: 'SENT', profitLoss: null, settled: false, settledAt: null, returnOfId: null },
    { id: 3, senderId: 3, receiverId: 2, ipoId: 1, amount: 30000, mode: 'BANK', date: '2026-09-24T09:15:00', notes: '2 lots via Rahul', status: 'SETTLED_UNALLOCATED', profitLoss: null, settled: true, settledAt: '2026-09-27T14:00:00', returnOfId: null },
    { id: 4, senderId: 2, receiverId: 3, ipoId: 1, amount: 30000, mode: 'BANK', date: '2026-09-27T14:00:00', notes: 'Return of txn #3', status: 'SETTLED_UNALLOCATED', profitLoss: null, settled: true, settledAt: '2026-09-27T14:00:00', returnOfId: 3 },
    { id: 5, senderId: 4, receiverId: null, ipoId: 2, amount: 14400, mode: 'UPI', date: '2026-08-11T12:20:00', notes: null, status: 'SETTLED_SOLD', profitLoss: 2500, settled: true, settledAt: '2026-08-26T10:05:00', returnOfId: null },
    { id: 6, senderId: null, receiverId: 4, ipoId: 2, amount: 16900, mode: 'UPI', date: '2026-08-26T10:00:00', notes: 'Return of txn #5 (P&L +2500)', status: 'SETTLED_SOLD', profitLoss: null, settled: true, settledAt: '2026-08-26T10:00:00', returnOfId: 5 },
    { id: 7, senderId: 2, receiverId: null, ipoId: 2, amount: 14400, mode: 'CASH', date: '2026-08-12T16:40:00', notes: null, status: 'SETTLED_UNALLOCATED', profitLoss: null, settled: true, settledAt: '2026-08-20T11:30:00', returnOfId: null },
    { id: 8, senderId: null, receiverId: 2, ipoId: 2, amount: 14400, mode: 'CASH', date: '2026-08-20T11:30:00', notes: 'Return of txn #7', status: 'SETTLED_UNALLOCATED', profitLoss: null, settled: true, settledAt: '2026-08-20T11:30:00', returnOfId: 7 },
  ];
  var apps = [
    { id: 1, personId: 1, personName: 'Ganesh Kumar', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', amount: 15000, status: 'ALLOTTED', appliedDate: '2026-09-23', allottedBy: 'me', allottedAt: '2026-09-28T09:00:00', profitLoss: null, soldAt: null, remarks: null },
    { id: 2, personId: 2, personName: 'Priya Sharma', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', amount: 15000, status: 'APPLIED', appliedDate: '2026-09-23', allottedBy: null, allottedAt: null, profitLoss: null, soldAt: null, remarks: null },
    { id: 3, personId: 3, personName: 'Rahul Verma', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', amount: 30000, status: 'NOT_ALLOTTED', appliedDate: '2026-09-24', allottedBy: null, allottedAt: null, profitLoss: null, soldAt: null, remarks: null },
    { id: 4, personId: 4, personName: 'Sneha Iyer', ipoId: 2, ipoName: 'NovaTech Systems Ltd', amount: 14400, status: 'ALLOTTED', appliedDate: '2026-08-11', allottedBy: 'me', allottedAt: '2026-08-22T09:00:00', profitLoss: 2500, soldAt: '2026-08-26T10:05:00', remarks: null },
    { id: 5, personId: 2, personName: 'Priya Sharma', ipoId: 2, ipoName: 'NovaTech Systems Ltd', amount: 14400, status: 'NOT_ALLOTTED', appliedDate: '2026-08-12', allottedBy: null, allottedAt: null, profitLoss: null, soldAt: null, remarks: null },
  ];
  var kycStore = {
    1: { personId: 1, panNumber: 'ABCDE1234F', email: 'ganesh.k@example.com', dematBroker: 'Zerodha', accountLoginId: 'GK123', accountPassword: null, mpin: null, updatedAt: '2026-09-01T10:00:00' },
  };

  var DEMO_USER = { id: 1, name: 'Demo User', email: 'demo@example.com' };
  var DEMO_TOKEN = 'preview-token';

  /* ---------------- ledger math (mirrors backend Ledger) ---------------- */
  function partyKey(pid) { return pid == null ? 'ME' : 'P:' + pid; }
  function partyName(pid) {
    if (pid == null) return 'Me';
    var p = people.find(function (x) { return x.id === pid; });
    return p ? p.name : 'Person #' + pid;
  }
  function ipoName(iid) {
    var i = ipos.find(function (x) { return x.id === iid; });
    return i ? i.name : 'IPO #' + iid;
  }
  function tripleKey(t) {
    return partyKey(t.senderId) + '|' + partyKey(t.receiverId) + '|' + t.ipoId;
  }
  function byDate(a, b) {
    var d = (a.date || '').localeCompare(b.date || '');
    return d !== 0 ? d : a.id - b.id;
  }
  /** txn id -> outstanding (FIFO of return legs against debt legs). */
  function outstandingByTxn(list) {
    var debts = {}, returns = {};
    list.forEach(function (t) {
      var k = tripleKey(t);
      if (t.returnOfId != null) {
        // A return leg offsets the reverse triple.
        var rk = partyKey(t.receiverId) + '|' + partyKey(t.senderId) + '|' + t.ipoId;
        (returns[rk] = returns[rk] || []).push(t);
      } else {
        (debts[k] = debts[k] || []).push(t);
      }
    });
    var out = {};
    Object.keys(debts).forEach(function (k) {
      var legs = debts[k].slice().sort(byDate);
      var pool = (returns[k] || []).slice().sort(byDate).map(function (t) { return t.amount; });
      var ri = 0;
      legs.forEach(function (debt) {
        if (debt.settled) { out[debt.id] = 0; return; }
        var need = debt.amount || 0;
        while (need > 0 && ri < pool.length) {
          var use = Math.min(pool[ri], need);
          need -= use; pool[ri] -= use;
          if (pool[ri] === 0) ri++;
        }
        out[debt.id] = need;
      });
    });
    list.forEach(function (t) { if (!(t.id in out)) out[t.id] = 0; });
    return out;
  }
  function struckByTxn(list, outstanding) {
    var s = {};
    list.forEach(function (t) {
      s[t.id] = t.returnOfId == null && (t.settled || (outstanding[t.id] || 0) === 0);
    });
    return s;
  }
  /** tripleKey -> net outstanding (> 0 only). */
  function netByTriple(list, outstanding) {
    var net = {};
    list.forEach(function (t) {
      if (t.returnOfId != null) return;
      var o = outstanding[t.id] || 0;
      if (o > 0) net[tripleKey(t)] = (net[tripleKey(t)] || 0) + o;
    });
    return net;
  }
  /** Transaction -> wire DTO shape (frontend Transaction type). */
  function txnDto(t) {
    var out = outstandingByTxn(txns);
    var struck = struckByTxn(txns, out);
    return {
      id: t.id,
      senderId: t.senderId, senderName: partyName(t.senderId),
      receiverId: t.receiverId, receiverName: partyName(t.receiverId),
      ipoId: t.ipoId, ipoName: ipoName(t.ipoId),
      amount: t.amount, mode: t.mode, date: t.date, notes: t.notes,
      status: t.status, profitLoss: t.profitLoss,
      settled: !!t.settled, settledAt: t.settledAt || null,
      returnOfId: t.returnOfId == null ? null : t.returnOfId,
      outstanding: out[t.id] || 0, struck: !!struck[t.id],
    };
  }
  function withAppNames(a) {
    a.personName = a.personName || partyName(a.personId);
    a.ipoName = a.ipoName || ipoName(a.ipoId);
    return a;
  }

  /* ---------------- report builders ---------------- */
  function personReport(pid, q) {
    var person = people.find(function (p) { return p.id === pid; });
    if (!person) return null;
    var includeSettled = q.get('includeSettled') === 'true';
    var onlyUnallotted = q.get('onlyUnallotted') === 'true';
    var ipoId = q.get('ipoId') ? Number(q.get('ipoId')) : null;
    var fromDate = q.get('fromDate'), toDate = q.get('toDate');
    var pkey = partyKey(pid);
    var out = outstandingByTxn(txns);
    var struck = struckByTxn(txns, out);
    var rows = [];
    ipos.forEach(function (ipo) {
      if (ipoId && ipo.id !== ipoId) return;
      var ipoApps = apps.filter(function (a) { return a.personId === pid && a.ipoId === ipo.id; }).map(withAppNames);
      if (onlyUnallotted && ipoApps.some(function (a) { return a.status === 'ALLOTTED'; })) return;
      var involved = txns.filter(function (t) {
        return t.ipoId === ipo.id && (t.senderId === pid || t.receiverId === pid);
      });
      // Ledger truth is computed over everything; filters only change
      // what is listed and summed.
      var listed = involved.filter(function (t) {
        if (!includeSettled && t.settled) return false;
        if (fromDate && (t.date || '') < fromDate) return false;
        if (toDate && (t.date || '') > toDate + 'T23:59:59') return false;
        return true;
      });
      var received = listed.filter(function (t) { return t.receiverId === pid; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      var sent = listed.filter(function (t) { return t.senderId === pid; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      var applied = ipoApps.reduce(function (s, a) { return s + a.amount; }, 0);
      if (!includeSettled && received === 0 && sent === 0 && applied === 0) return;
      if (q.get('fromDate') || q.get('toDate')) {
        if (received === 0 && sent === 0 && applied === 0) return;
      }
      var owes = [], owedBy = [];
      var net = netByTriple(involved, out);
      Object.keys(net).forEach(function (k) {
        var parts = k.split('|');
        var amt = net[k];
        if (parts[1] === pkey) {
          var sid = parts[0] === 'ME' ? null : Number(parts[0].slice(2));
          owes.push({ partyId: sid, partyName: partyName(sid), amount: amt });
        } else if (parts[0] === pkey) {
          var rid = parts[1] === 'ME' ? null : Number(parts[1].slice(2));
          owedBy.push({ partyId: rid, partyName: partyName(rid), amount: amt });
        }
      });
      owes.sort(function (a, b) { return b.amount - a.amount; });
      owedBy.sort(function (a, b) { return b.amount - a.amount; });
      var outstanding = owes.reduce(function (s, o) { return s + o.amount; }, 0);
      var txnDtos = listed.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
        .map(function (t) {
          var d = txnDto(t);
          return d;
        });
      var status = ipoApps.some(function (a) { return a.status === 'ALLOTTED'; })
        ? 'ALLOTTED'
        : ipoApps.some(function (a) { return a.status === 'APPLIED'; })
          ? 'APPLIED'
          : ipoApps.length ? ipoApps[0].status : ipo.status;
      rows.push({
        ipoId: ipo.id, ipoName: ipo.name, applied: applied, status: status,
        applications: ipoApps, transactions: txnDtos,
        owes: owes, owedBy: owedBy,
        received: received, sent: sent, outstanding: outstanding,
      });
    });
    return {
      person: person,
      kyc: maskedKyc(kycStore[pid] || null),
      ipos: rows,
      totals: {
        applied: rows.reduce(function (s, r) { return s + r.applied; }, 0),
        received: rows.reduce(function (s, r) { return s + r.received; }, 0),
        sent: rows.reduce(function (s, r) { return s + r.sent; }, 0),
        outstanding: rows.reduce(function (s, r) { return s + r.outstanding; }, 0),
      },
    };
  }

  function ipoSummary(iid) {
    var ipo = ipos.find(function (x) { return x.id === iid; });
    if (!ipo) return null;
    var list = txns.filter(function (t) { return t.ipoId === iid; });
    var out = outstandingByTxn(txns);
    var struck = struckByTxn(txns, out);
    var txnDtos = list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
      .map(function (t) {
        var d = txnDto(t);
        return d;
      });
    var debts = [];
    var net = netByTriple(list, out);
    Object.keys(net).forEach(function (k) {
      var parts = k.split('|');
      var sid = parts[0] === 'ME' ? null : Number(parts[0].slice(2));
      var rid = parts[1] === 'ME' ? null : Number(parts[1].slice(2));
      debts.push({ senderId: sid, senderName: partyName(sid), receiverId: rid, receiverName: partyName(rid), amount: net[k] });
    });
    debts.sort(function (a, b) { return b.amount - a.amount; });
    var ipoApps = apps.filter(function (a) { return a.ipoId === iid; }).map(withAppNames);
    var funding = ipoApps.map(function (app) {
      var akey = partyKey(app.personId);
      var byFunder = {};
      list.forEach(function (t) {
        if (t.returnOfId != null) return;
        if (partyKey(t.receiverId) !== akey) return;
        var fk = partyKey(t.senderId);
        (byFunder[fk] = byFunder[fk] || []).push(t);
      });
      var funders = Object.keys(byFunder).map(function (fk) {
        var legs = byFunder[fk];
        var fid = fk === 'ME' ? null : Number(fk.slice(2));
        return {
          funderId: fid, funderName: partyName(fid),
          amount: legs.reduce(function (s, t) { return s + t.amount; }, 0),
          outstanding: legs.reduce(function (s, t) { return s + (out[t.id] || 0); }, 0),
        };
      }).sort(function (a, b) { return b.amount - a.amount; });
      return {
        application: app, funders: funders,
        fundedTotal: funders.reduce(function (s, f) { return s + f.amount; }, 0),
        outstandingTotal: funders.reduce(function (s, f) { return s + f.outstanding; }, 0),
      };
    });
    return {
      ipoId: ipo.id, ipoName: ipo.name, status: ipo.status,
      applicationCount: ipoApps.length,
      allottedCount: ipoApps.filter(function (a) { return a.status === 'ALLOTTED'; }).length,
      notAllottedCount: ipoApps.filter(function (a) { return a.status === 'NOT_ALLOTTED'; }).length,
      appliedTotal: ipoApps.reduce(function (s, a) { return s + a.amount; }, 0),
      transactions: txnDtos, outstanding: debts, applications: funding,
      receivedTotal: list.filter(function (t) { return t.returnOfId == null; })
        .reduce(function (s, t) { return s + t.amount; }, 0),
      outstandingTotal: debts.reduce(function (s, d) { return s + d.amount; }, 0),
    };
  }

  function dashboardStats() {
    var out = outstandingByTxn(txns);
    var moneyReceived = txns.filter(function (t) { return t.returnOfId == null && t.receiverId == null; })
      .reduce(function (s, t) { return s + t.amount; }, 0);
    var net = netByTriple(txns, out);
    var youOwe = 0, owedToYou = 0, otherCount = 0, otherAmount = 0;
    Object.keys(net).forEach(function (k) {
      var parts = k.split('|');
      var amt = net[k];
      if (parts[1] === 'ME') youOwe += amt;
      else if (parts[0] === 'ME') owedToYou += amt;
      else { otherCount++; otherAmount += amt; }
    });
    var yearStart = new Date(new Date().getFullYear(), 0, 1);
    var ytd = apps.filter(function (a) { return true; }); // mock: all seeded this year
    var allotted = ytd.filter(function (a) { return a.status === 'ALLOTTED'; }).length;
    return {
      activeIpos: ipos.filter(function (i) { return i.status === 'OPEN'; }).length,
      moneyReceived: moneyReceived,
      peopleCount: people.length,
      youOwe: youOwe,
      owedToYou: owedToYou,
      pendingSettlements: { count: otherCount, amount: otherAmount },
      allotmentRateYtd: ytd.length ? +(100 * allotted / ytd.length).toFixed(1) : 0,
    };
  }

  function allotments() {
    return apps.filter(function (a) { return a.status === 'ALLOTTED'; }).map(function (a) {
      withAppNames(a);
      return {
        applicationId: a.id, ipoId: a.ipoId, ipoName: a.ipoName,
        personId: a.personId, personName: a.personName,
        amount: a.amount, lots: null, allottedAt: a.allottedAt,
      };
    });
  }

  function profitLoss(period) {
    var now = new Date();
    var cutoff = new Date(0);
    if (period === 'MTD') cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === '1W') cutoff = new Date(now.getTime() - 7 * 864e5);
    else if (period === '1M') cutoff = new Date(now.getTime() - 30 * 864e5);
    else if (period === '3M') cutoff = new Date(now.getTime() - 90 * 864e5);
    else if (period === '6M') cutoff = new Date(now.getTime() - 180 * 864e5);
    var entries = apps
      .filter(function (a) { return a.profitLoss != null && a.soldAt && new Date(a.soldAt) >= cutoff; })
      .map(function (a) {
        withAppNames(a);
        return {
          applicationId: a.id, ipoId: a.ipoId, ipoName: a.ipoName,
          personId: a.personId, personName: a.personName,
          amount: a.amount, profitLoss: a.profitLoss, soldAt: a.soldAt,
        };
      })
      .sort(function (a, b) { return (b.soldAt || '').localeCompare(a.soldAt || ''); });
    function buckets(key) {
      var m = {};
      entries.forEach(function (e) {
        var k = key === 'ipo' ? e.ipoName : e.personName;
        m[k] = m[k] || { name: k, total: 0, count: 0 };
        m[k].total += e.profitLoss; m[k].count += 1;
      });
      return Object.keys(m).map(function (k) { return m[k]; });
    }
    return {
      total: entries.reduce(function (s, e) { return s + e.profitLoss; }, 0),
      entries: entries, byIpo: buckets('ipo'), byPerson: buckets('person'),
    };
  }

  function reportMessage(pid, bodyQ) {
    var rep = personReport(pid, bodyQ);
    if (!rep) return 'IPO Manager report (preview)';
    var scoped = rep.ipos.length === 1 && bodyQ.get('ipoId');
    var lines = [];
    if (scoped) {
      var row = rep.ipos[0];
      lines.push('Hi ' + rep.person.name + ', ' + row.ipoName + ':');
      row.owes.forEach(function (o) {
        lines.push('You owe Rs.' + o.amount + ' to ' + o.partyName);
      });
      row.owedBy.forEach(function (o) {
        lines.push('Rs.' + o.amount + ' owed to you from ' + o.partyName);
      });
      row.transactions.forEach(function (t) {
        var note = t.struck ? (t.returnOfId != null ? ' · return' : ' · settled') : '';
        lines.push(t.senderName + ' → ' + t.receiverName + ' Rs.' + t.amount + note);
      });
      lines.push('Still owed by you: Rs.' + row.outstanding + (row.outstanding === 0 ? ' — settled.' : ' — pending.'));
    } else {
      lines.push('Hi ' + rep.person.name + ', your IPO summary:');
      rep.ipos.forEach(function (r) {
        var to = r.owes.map(function (o) { return o.partyName; }).join(', ');
        lines.push('- ' + r.ipoName + ': ' + (r.outstanding > 0 ? 'you owe Rs.' + r.outstanding + (to ? ' (' + to + ')' : '') : 'settled'));
      });
      lines.push('Totals — received Rs.' + rep.totals.received + ', sent Rs.' + rep.totals.sent + ', you owe Rs.' + rep.totals.outstanding);
    }
    lines.push('— via IPO Manager');
    return lines.join('\n');
  }

  /* ---------------- helpers ---------------- */
  function json(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  function err(message, status) { return json({ error: message }, status || 400); }
  function noContent() { return new Response(null, { status: 204 }); }
  function mask(v) {
    if (v == null || v === '') return v;
    var s = String(v);
    if (s.length <= 4) return '••••';
    return '••••' + s.slice(-4);
  }
  function maskedKyc(k) {
    if (!k) return null;
    return {
      personId: k.personId,
      panNumber: mask(k.panNumber), email: mask(k.email),
      dematBroker: k.dematBroker, accountLoginId: mask(k.accountLoginId),
      accountPassword: k.accountPassword ? '••••••' : null,
      mpin: k.mpin ? '••••' : null, updatedAt: k.updatedAt,
    };
  }
  function nowIso() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ---------------- router ---------------- */
  function handle(path, init) {
    var method = (init.method || 'GET').toUpperCase();
    var qIndex = path.indexOf('?');
    var route = qIndex === -1 ? path : path.slice(0, qIndex);
    var q = new URLSearchParams(qIndex === -1 ? '' : path.slice(qIndex + 1));
    var body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch (e) { body = null; }

    /* public: auth */
    if (route === '/api/auth/register' && method === 'POST') {
      if (!body || !body.name || !body.email || !body.password) return err('Name, email and password are required.', 400);
      return json({ id: DEMO_USER.id, name: body.name, email: body.email, token: DEMO_TOKEN });
    }
    if (route === '/api/auth/login' && method === 'POST') {
      if (!body || !body.email || !body.password) return err('Email and password are required.', 400);
      return json({ id: DEMO_USER.id, name: DEMO_USER.name, email: body.email, token: DEMO_TOKEN });
    }
    /* everything else needs the demo token (mirrors the real 401 behaviour) */
    var headers = init.headers || {};
    var auth = headers['Authorization'] || headers['authorization'] || '';
    var authed = auth === 'Bearer ' + DEMO_TOKEN;
    if (route === '/api/auth/me') {
      return authed ? json(DEMO_USER) : err('Unauthorized', 401);
    }
    if (!authed) return err('Unauthorized', 401);

    /* dashboard */
    if (route === '/api/dashboard/stats' && method === 'GET') return json(dashboardStats());
    if (route === '/api/dashboard/allotments' && method === 'GET') return json(allotments());
    if (route === '/api/dashboard/profit-loss' && method === 'GET') return json(profitLoss(q.get('period') || 'MTD'));

    /* ipos */
    if (route === '/api/ipos' && method === 'GET') return json(ipos);
    if (route === '/api/ipos' && method === 'POST') {
      var ni = Object.assign({ id: seq.ipo++ }, body);
      ipos.push(ni); return json(ni, 201);
    }
    var mSum = route.match(/^\/api\/ipos\/(\d+)\/summary$/);
    if (mSum && method === 'GET') {
      var sum = ipoSummary(Number(mSum[1]));
      return sum ? json(sum) : err('IPO not found', 404);
    }
    var mIpo = route.match(/^\/api\/ipos\/(\d+)$/);
    if (mIpo) {
      var iid = Number(mIpo[1]);
      var ix = ipos.findIndex(function (x) { return x.id === iid; });
      if (ix === -1) return err('IPO not found', 404);
      if (method === 'GET') return json(ipos[ix]);
      if (method === 'PUT') { ipos[ix] = Object.assign({}, ipos[ix], body, { id: iid }); return json(ipos[ix]); }
      if (method === 'DELETE') {
        ipos.splice(ix, 1);
        txns = txns.filter(function (t) { return t.ipoId !== iid; });
        apps = apps.filter(function (a) { return a.ipoId !== iid; });
        return noContent();
      }
    }

    /* people */
    if (route === '/api/people' && method === 'GET') return json(people);
    if (route === '/api/people' && method === 'POST') {
      var np = Object.assign({ id: seq.person++, createdAt: nowIso() }, body);
      people.push(np); return json(np, 201);
    }
    var mKyc = route.match(/^\/api\/people\/(\d+)\/kyc$/);
    if (mKyc) {
      var kid = Number(mKyc[1]);
      if (method === 'GET') {
        var k = kycStore[kid] || null;
        return json(q.get('reveal') === 'true' ? k : maskedKyc(k));
      }
      if (method === 'PUT') {
        kycStore[kid] = Object.assign({ personId: kid, updatedAt: nowIso() }, body);
        return json(maskedKyc(kycStore[kid]));
      }
    }
    var mRep = route.match(/^\/api\/people\/(\d+)\/report$/);
    if (mRep && method === 'GET') {
      var rep = personReport(Number(mRep[1]), q);
      return rep ? json(rep) : err('Person not found', 404);
    }
    var mPerson = route.match(/^\/api\/people\/(\d+)$/);
    if (mPerson) {
      var perId = Number(mPerson[1]);
      var pIdx = people.findIndex(function (x) { return x.id === perId; });
      if (pIdx === -1) return err('Person not found', 404);
      if (method === 'GET') return json(people[pIdx]);
      if (method === 'PUT') { people[pIdx] = Object.assign({}, people[pIdx], body, { id: perId }); return json(people[pIdx]); }
      if (method === 'DELETE') {
        people.splice(pIdx, 1);
        txns = txns.filter(function (t) { return t.senderId !== perId && t.receiverId !== perId; });
        apps = apps.filter(function (a) { return a.personId !== perId; });
        return noContent();
      }
    }

    /* transactions */
    if (route === '/api/transactions' && method === 'GET') {
      var list = txns.map(txnDto);
      if (q.get('ipoId')) list = list.filter(function (t) { return t.ipoId === Number(q.get('ipoId')); });
      if (q.get('partyId')) {
        var party = Number(q.get('partyId'));
        list = list.filter(function (t) { return t.senderId === party || t.receiverId === party; });
      }
      if (q.get('pendingOnly') === 'true') {
        list = list.filter(function (t) { return t.outstanding > 0 && !t.settled && t.returnOfId == null; });
      }
      list.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      return json(list);
    }
    if (route === '/api/transactions' && method === 'POST') {
      if ((body.senderId == null) && (body.receiverId == null)) return err('One side of the movement must be a person.', 400);
      if (body.senderId != null && body.senderId === body.receiverId) return err('Sender and receiver cannot be the same person.', 400);
      var nt = {
        id: seq.txn++,
        senderId: body.senderId == null ? null : body.senderId,
        receiverId: body.receiverId == null ? null : body.receiverId,
        ipoId: body.ipoId, amount: body.amount, mode: body.mode || 'UPI',
        date: body.date || nowIso(), notes: body.notes || null,
        status: 'SENT', profitLoss: null,
        settled: false, settledAt: null, returnOfId: null,
      };
      txns.push(nt); return json(txnDto(nt), 201);
    }
    var mRet = route.match(/^\/api\/transactions\/(\d+)\/return$/);
    if (mRet && method === 'POST') {
      var orig = txns.find(function (x) { return x.id === Number(mRet[1]); });
      if (!orig) return err('Transaction not found', 404);
      if (orig.settled) return err('This transaction is already settled', 400);
      if (orig.returnOfId != null) return err('Return legs cannot be returned', 400);
      var pl = body && body.profitLoss != null ? body.profitLoss : null;
      var retAmt = orig.amount + (pl == null ? 0 : pl);
      if (!(retAmt > 0)) return err('Return amount must be positive — check the profit/loss', 400);
      var status = pl == null ? 'SETTLED_UNALLOCATED' : 'SETTLED_SOLD';
      var leg = {
        id: seq.txn++,
        senderId: orig.receiverId, receiverId: orig.senderId,
        ipoId: orig.ipoId, amount: retAmt, mode: orig.mode,
        date: nowIso(),
        notes: 'Return of txn #' + orig.id + (pl == null ? '' : ' (P&L ' + (pl >= 0 ? '+' : '') + pl + ')'),
        status: status, profitLoss: null,
        settled: true, settledAt: nowIso(), returnOfId: orig.id,
      };
      txns.push(leg);
      orig.status = status; orig.settled = true; orig.settledAt = nowIso();
      if (pl != null) {
        orig.profitLoss = pl;
        if (orig.receiverId != null) {
          apps.forEach(function (a) {
            if (a.personId === orig.receiverId && a.ipoId === orig.ipoId) {
              a.profitLoss = (a.profitLoss || 0) + pl;
              a.soldAt = nowIso();
            }
          });
        }
      }
      return json(txnDto(orig));
    }
    var mTxn = route.match(/^\/api\/transactions\/(\d+)$/);
    if (mTxn) {
      var tid = Number(mTxn[1]);
      var te = txns.find(function (x) { return x.id === tid; });
      if (!te) return err('Transaction not found', 404);
      if (method === 'PUT') {
        if (te.returnOfId != null) return err('Return legs cannot be edited — delete and re-record the return', 400);
        ['senderId', 'receiverId', 'ipoId', 'amount', 'mode', 'date', 'notes'].forEach(function (f) {
          if (body[f] !== undefined) te[f] = body[f];
        });
        return json(txnDto(te));
      }
      if (method === 'DELETE') {
        var hasReturns = txns.some(function (x) { return x.returnOfId === tid; });
        if (hasReturns) return err('Delete the return leg first before deleting this transaction', 400);
        if (te.returnOfId != null) {
          // Deleting a return leg re-opens the original, mirroring the backend.
          var orig = txns.find(function (x) { return x.id === te.returnOfId; });
          if (orig) {
            var postedPnl = orig.profitLoss || 0;
            orig.status = 'UNALLOCATED'; orig.profitLoss = null; orig.settled = false; orig.settledAt = null;
            if (postedPnl && orig.receiverPersonId != null) {
              applications.forEach(function (a) {
                if (a.personId === orig.receiverPersonId && a.ipoId === orig.ipoId) {
                  a.profitLoss = (a.profitLoss || 0) - postedPnl;
                }
              });
            }
          }
        }
        txns = txns.filter(function (x) { return x.id !== tid; });
        return noContent();
      }
    }

    /* applications */
    if (route === '/api/applications' && method === 'GET') {
      var al = apps.map(withAppNames);
      if (q.get('ipoId')) al = al.filter(function (a) { return a.ipoId === Number(q.get('ipoId')); });
      if (q.get('personId')) al = al.filter(function (a) { return a.personId === Number(q.get('personId')); });
      return json(al);
    }
    if (route === '/api/applications' && method === 'POST') {
      var dup = apps.some(function (a) { return a.personId === body.personId && a.ipoId === body.ipoId; });
      if (dup) return err('This person already has an application for this IPO.', 400);
      var na = Object.assign(
        { id: seq.app++, status: 'APPLIED', allottedBy: null, allottedAt: null, profitLoss: null, soldAt: null, remarks: null },
        body);
      withAppNames(na); apps.push(na); return json(na, 201);
    }
    var mAppStatus = route.match(/^\/api\/applications\/(\d+)\/status$/);
    if (mAppStatus && method === 'PATCH') {
      var as = apps.find(function (x) { return x.id === Number(mAppStatus[1]); });
      if (!as) return err('Application not found', 404);
      as.status = body.status;
      if (body.status === 'ALLOTTED') { as.allottedBy = 'me'; as.allottedAt = nowIso(); }
      else { as.allottedBy = null; as.allottedAt = null; }
      // Mirror the backend: open funding legs follow the allotment state,
      // but debt is only cleared when money is actually returned.
      txns.forEach(function (t) {
        if (t.receiverId === as.personId && t.ipoId === as.ipoId && t.returnOfId == null && !t.settled) {
          t.status = body.status === 'ALLOTTED' ? 'ALLOCATED' : 'UNALLOCATED';
        }
      });
      return json(withAppNames(as));
    }
    var mAppSale = route.match(/^\/api\/applications\/(\d+)\/sale$/);
    if (mAppSale && method === 'PATCH') {
      var sa = apps.find(function (x) { return x.id === Number(mAppSale[1]); });
      if (!sa) return err('Application not found', 404);
      sa.profitLoss = body.profitLoss;
      sa.soldAt = (body && body.soldAt) || nowIso();
      return json(withAppNames(sa));
    }

    /* allotment checking */
    if (route === '/api/allotment/registrar-ipos' && method === 'GET') {
      return json([
        { id: 'demo-kf-1', name: 'Shree Ganesh Agro Limited' },
        { id: 'demo-kf-2', name: 'Some Other IPO Limited' },
      ]);
    }
    if (route === '/api/allotment/detect' && method === 'POST') {
      var di = ipos.find(function (x) { return x.id === Number(body.ipoId); });
      if (!di) return err('IPO not found', 404);
      if (di.registrar && di.registrarRef) {
        return json({ registrar: di.registrar, registrarRef: di.registrarRef,
          registrarName: null, confidence: 1, message: 'Already set.' });
      }
      di.registrar = 'KFINTECH';
      di.registrarRef = 'demo-kf-1';
      return json({ registrar: 'KFINTECH', registrarRef: 'demo-kf-1',
        registrarName: 'Shree Ganesh Agro Limited',
        confidence: 0.95,
        message: 'Matched automatically — change it if this looks wrong.' });
    }
    if (route === '/api/allotment/check' && method === 'POST') {
      var ci = ipos.find(function (x) { return x.id === Number(body.ipoId); });
      var cp = people.find(function (x) { return x.id === Number(body.personId); });
      if (!ci || !cp) return err('Not found', 404);
      /* deterministic demo: even person ids get allotted */
      var won = Number(body.personId) % 2 === 0;
      var out = won ? 'ALLOTTED' : 'NOT_ALLOTTED';
      var ca = apps.find(function (a) {
        return a.personId === Number(body.personId) && a.ipoId === Number(body.ipoId);
      });
      if (ca) {
        ca.status = out;
        ca.allottedBy = 'Auto-check';
      }
      return json({
        applicationId: ca ? ca.id : null,
        personId: Number(body.personId),
        outcome: out,
        allottedShares: won ? 24 : null,
        message: won ? 'Allotted 24 shares.'
          : 'Application found, but no shares allotted.',
      });
    }

    /* reports */
    if (route === '/api/reports/send' && method === 'POST') {
      var bq = new URLSearchParams();
      if (body.ipoId) bq.set('ipoId', String(body.ipoId));
      if (body.includeSettled) bq.set('includeSettled', 'true');
      if (body.onlyUnallotted) bq.set('onlyUnallotted', 'true');
      if (body.fromDate) bq.set('fromDate', body.fromDate);
      if (body.toDate) bq.set('toDate', body.toDate);
      var msg = reportMessage(body.personId, bq);
      return json({ status: 'ok', waLink: 'https://wa.me/?text=' + encodeURIComponent(msg), message: msg });
    }

    return err('Preview API: no mock for ' + method + ' ' + route, 404);
  }

  window.fetch = function (url, init) {
    var u = typeof url === 'string' ? url : (url && url.url) || '';
    var idx = u.indexOf('/api/');
    if (idx === -1) return realFetch(url, init);
    var path = u.slice(idx);
    try {
      return Promise.resolve(handle(path, init || {}));
    } catch (e) {
      return Promise.resolve(err('Preview mock error: ' + (e && e.message), 500));
    }
  };
})();
