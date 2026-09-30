/* Preview-only mock backend for the IPO Manager mobile UI preview.
 * Intercepts window.fetch for /api/** and serves an in-memory dataset,
 * so the REAL built frontend bundle runs unmodified (auth + all CRUD).
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
  var txns = [
    { id: 1, personId: 1, personName: 'Ganesh Kumar', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', direction: 'RECEIVED', amount: 15000, mode: 'UPI', date: '2026-09-23T10:30:00', settled: false, settledAt: null, notes: null, sender: 'Ganesh', receiver: 'HDFC pool', status: 'ALLOCATED', profitLoss: null },
    { id: 2, personId: 2, personName: 'Priya Sharma', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', direction: 'RECEIVED', amount: 15000, mode: 'UPI', date: '2026-09-23T11:05:00', settled: false, settledAt: null, notes: null, sender: 'Priya', receiver: 'HDFC pool', status: 'SENT', profitLoss: null },
    { id: 3, personId: 3, personName: 'Rahul Verma', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', direction: 'RECEIVED', amount: 30000, mode: 'BANK', date: '2026-09-24T09:15:00', settled: false, settledAt: null, notes: '2 lots', sender: 'Rahul', receiver: 'HDFC pool', status: 'UNALLOCATED', profitLoss: null },
    { id: 4, personId: 1, personName: 'Ganesh Kumar', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', direction: 'SENT', amount: 15000, mode: 'UPI', date: '2026-09-27T14:00:00', settled: true, settledAt: '2026-09-27T14:00:00', notes: 'Refund — not allotted', sender: 'HDFC pool', receiver: 'Ganesh', status: 'SETTLED_UNALLOCATED', profitLoss: null },
    { id: 5, personId: 4, personName: 'Sneha Iyer', ipoId: 2, ipoName: 'NovaTech Systems Ltd', direction: 'RECEIVED', amount: 14400, mode: 'UPI', date: '2026-08-11T12:20:00', settled: false, settledAt: null, notes: null, sender: 'Sneha', receiver: 'HDFC pool', status: 'ALLOCATED', profitLoss: null },
    { id: 6, personId: 4, personName: 'Sneha Iyer', ipoId: 2, ipoName: 'NovaTech Systems Ltd', direction: 'SENT', amount: 16900, mode: 'UPI', date: '2026-08-26T10:00:00', settled: true, settledAt: '2026-08-26T10:00:00', notes: 'Sale proceeds sent back', sender: 'HDFC pool', receiver: 'Sneha', status: 'SETTLED_SOLD', profitLoss: 2500 },
    { id: 7, personId: 2, personName: 'Priya Sharma', ipoId: 2, ipoName: 'NovaTech Systems Ltd', direction: 'RECEIVED', amount: 14400, mode: 'CASH', date: '2026-08-12T16:40:00', settled: true, settledAt: '2026-08-20T11:30:00', notes: null, sender: 'Priya', receiver: 'Me', status: 'SETTLED_UNALLOCATED', profitLoss: null },
    { id: 8, personId: 2, personName: 'Priya Sharma', ipoId: 2, ipoName: 'NovaTech Systems Ltd', direction: 'SENT', amount: 14400, mode: 'CASH', date: '2026-08-20T11:30:00', settled: true, settledAt: '2026-08-20T11:30:00', notes: 'Refund — not allotted', sender: 'Me', receiver: 'Priya', status: 'SETTLED_UNALLOCATED', profitLoss: null },
  ];
  var apps = [
    { id: 1, personId: 1, personName: 'Ganesh Kumar', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', amount: 15000, status: 'ALLOTTED', appliedDate: '2026-09-23', allottedBy: 'me', allottedAt: '2026-09-28T09:00:00', refund: null, profitLoss: null, soldAt: null, remarks: null },
    { id: 2, personId: 2, personName: 'Priya Sharma', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', amount: 15000, status: 'APPLIED', appliedDate: '2026-09-23', allottedBy: null, allottedAt: null, refund: null, profitLoss: null, soldAt: null, remarks: null },
    { id: 3, personId: 3, personName: 'Rahul Verma', ipoId: 1, ipoName: 'Shree Ganesh Agro Ltd', amount: 30000, status: 'NOT_ALLOTTED', appliedDate: '2026-09-24', allottedBy: null, allottedAt: null, refund: null, profitLoss: null, soldAt: null, remarks: null },
    { id: 4, personId: 4, personName: 'Sneha Iyer', ipoId: 2, ipoName: 'NovaTech Systems Ltd', amount: 14400, status: 'ALLOTTED', appliedDate: '2026-08-11', allottedBy: 'me', allottedAt: '2026-08-22T09:00:00', refund: null, profitLoss: 2500, soldAt: '2026-08-26T10:05:00', remarks: null },
    { id: 5, personId: 2, personName: 'Priya Sharma', ipoId: 2, ipoName: 'NovaTech Systems Ltd', amount: 14400, status: 'NOT_ALLOTTED', appliedDate: '2026-08-12', allottedBy: null, allottedAt: null, refund: null, profitLoss: null, soldAt: null, remarks: null },
  ];
  var kycStore = {
    1: { personId: 1, panNumber: 'ABCDE1234F', email: 'ganesh.k@example.com', dematBroker: 'Zerodha', accountLoginId: 'GK123', accountPassword: null, mpin: null, updatedAt: '2026-09-01T10:00:00' },
  };

  var DEMO_USER = { id: 1, name: 'Demo User', email: 'demo@example.com' };
  var DEMO_TOKEN = 'preview-token';

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
  function personName(pid) {
    var p = people.find(function (x) { return x.id === pid; });
    return p ? p.name : 'Person #' + pid;
  }
  function ipoName(iid) {
    var i = ipos.find(function (x) { return x.id === iid; });
    return i ? i.name : 'IPO #' + iid;
  }
  function withNames(t) {
    t.personName = t.personName || personName(t.personId);
    t.ipoName = t.ipoName || ipoName(t.ipoId);
    return t;
  }
  function withAppNames(a) {
    a.personName = a.personName || personName(a.personId);
    a.ipoName = a.ipoName || ipoName(a.ipoId);
    return a;
  }

  function dashboardStats() {
    var received = txns.filter(function (t) { return t.direction === 'RECEIVED'; });
    var pending = received.filter(function (t) { return !t.settled; });
    var allotted = apps.filter(function (a) { return a.status === 'ALLOTTED'; }).length;
    return {
      activeIpos: ipos.filter(function (i) { return i.status === 'OPEN' || i.status === 'UPCOMING'; }).length,
      moneyReceived: received.reduce(function (s, t) { return s + t.amount; }, 0),
      peopleCount: people.length,
      pendingToCollect: apps.filter(function (a) { return a.status === 'APPLIED'; })
        .reduce(function (s, a) { return s + a.amount; }, 0),
      pendingSettlements: {
        count: pending.length,
        amount: pending.reduce(function (s, t) { return s + t.amount; }, 0),
      },
      allotmentRateYtd: apps.length ? +(100 * allotted / apps.length).toFixed(1) : 0,
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

  function personReport(pid, q) {
    var person = people.find(function (p) { return p.id === pid; });
    if (!person) return null;
    var includeSettled = q.get('includeSettled') !== 'false';
    var onlyUnallotted = q.get('onlyUnallotted') === 'true';
    var ipoId = q.get('ipoId') ? Number(q.get('ipoId')) : null;
    var fromDate = q.get('fromDate'), toDate = q.get('toDate');
    var rows = [];
    ipos.forEach(function (ipo) {
      if (ipoId && ipo.id !== ipoId) return;
      var ipoApps = apps.filter(function (a) { return a.personId === pid && a.ipoId === ipo.id; }).map(withAppNames);
      if (onlyUnallotted && ipoApps.some(function (a) { return a.status === 'ALLOTTED'; })) return;
      var ipoTxns = txns.filter(function (t) {
        if (t.personId !== pid || t.ipoId !== ipo.id) return false;
        if (!includeSettled && t.settled) return false;
        if (fromDate && t.date < fromDate) return false;
        if (toDate && t.date > toDate + 'T23:59:59') return false;
        return true;
      }).map(withNames).sort(function (a, b) { return b.date.localeCompare(a.date); });
      var applied = ipoApps.reduce(function (s, a) { return s + a.amount; }, 0);
      var received = ipoTxns.filter(function (t) { return t.direction === 'RECEIVED'; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      var sentBack = ipoTxns.filter(function (t) { return t.direction === 'SENT'; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      if (ipoApps.length === 0 && ipoTxns.length === 0) return;
      rows.push({
        ipoId: ipo.id, ipoName: ipo.name, applied: applied, received: received,
        sentBack: sentBack, held: received - sentBack, status: ipo.status,
        applications: ipoApps, transactions: ipoTxns,
      });
    });
    return {
      person: person,
      kyc: maskedKyc(kycStore[pid] || null),
      ipos: rows,
      totals: {
        applied: rows.reduce(function (s, r) { return s + r.applied; }, 0),
        received: rows.reduce(function (s, r) { return s + r.received; }, 0),
        sentBack: rows.reduce(function (s, r) { return s + r.sentBack; }, 0),
        held: rows.reduce(function (s, r) { return s + r.held; }, 0),
      },
    };
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
    var auth = (init.headers && init.headers['Authorization']) || '';
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
      var np = Object.assign({ id: seq.person++, createdAt: new Date().toISOString() }, body);
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
        kycStore[kid] = Object.assign({ personId: kid, updatedAt: new Date().toISOString() }, body);
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
        txns = txns.filter(function (t) { return t.personId !== perId; });
        apps = apps.filter(function (a) { return a.personId !== perId; });
        return noContent();
      }
    }

    /* transactions */
    if (route === '/api/transactions' && method === 'GET') {
      var list = txns.map(withNames);
      if (q.get('ipoId')) list = list.filter(function (t) { return t.ipoId === Number(q.get('ipoId')); });
      if (q.get('personId')) list = list.filter(function (t) { return t.personId === Number(q.get('personId')); });
      if (q.get('direction')) list = list.filter(function (t) { return t.direction === q.get('direction'); });
      if (q.get('pendingOnly') === 'true') list = list.filter(function (t) { return t.direction === 'RECEIVED' && !t.settled; });
      return json(list);
    }
    if (route === '/api/transactions' && method === 'POST') {
      var nt = Object.assign(
        { id: seq.txn++, settled: false, settledAt: null, sender: null, receiver: null, status: 'SENT', profitLoss: null, notes: null },
        body);
      withNames(nt); txns.push(nt); return json(nt, 201);
    }
    var mSettle = route.match(/^\/api\/transactions\/(\d+)\/settle$/);
    if (mSettle && method === 'PATCH') {
      var st = txns.find(function (x) { return x.id === Number(mSettle[1]); });
      if (!st) return err('Transaction not found', 404);
      var kind = (body && body.type) || 'UNALLOCATED';
      st.status = kind === 'SOLD' ? 'SETTLED_SOLD' : 'SETTLED_UNALLOCATED';
      st.settled = true; st.settledAt = new Date().toISOString();
      if (kind === 'SOLD' && body && body.profitLoss != null) st.profitLoss = body.profitLoss;
      return json(withNames(st));
    }
    var mTxn = route.match(/^\/api\/transactions\/(\d+)$/);
    if (mTxn && method === 'PUT') {
      var te = txns.find(function (x) { return x.id === Number(mTxn[1]); });
      if (!te) return err('Transaction not found', 404);
      Object.assign(te, body, { id: te.id });
      if (te.status === 'SETTLED_SOLD' || te.status === 'SETTLED_UNALLOCATED') { te.settled = true; }
      return json(withNames(te));
    }

    /* applications */
    if (route === '/api/applications' && method === 'GET') {
      var al = apps.map(withAppNames);
      if (q.get('ipoId')) al = al.filter(function (a) { return a.ipoId === Number(q.get('ipoId')); });
      if (q.get('personId')) al = al.filter(function (a) { return a.personId === Number(q.get('personId')); });
      return json(al);
    }
    if (route === '/api/applications' && method === 'POST') {
      var na = Object.assign(
        { id: seq.app++, status: 'APPLIED', allottedBy: null, allottedAt: null, refund: null, profitLoss: null, soldAt: null, remarks: null },
        body);
      withAppNames(na); apps.push(na); return json(na, 201);
    }
    var mAppStatus = route.match(/^\/api\/applications\/(\d+)\/status$/);
    if (mAppStatus && method === 'PATCH') {
      var as = apps.find(function (x) { return x.id === Number(mAppStatus[1]); });
      if (!as) return err('Application not found', 404);
      as.status = body.status;
      if (body.status === 'ALLOTTED') { as.allottedBy = 'me'; as.allottedAt = new Date().toISOString(); }
      return json(withAppNames(as));
    }
    var mAppSale = route.match(/^\/api\/applications\/(\d+)\/sale$/);
    if (mAppSale && method === 'PATCH') {
      var sa = apps.find(function (x) { return x.id === Number(mAppSale[1]); });
      if (!sa) return err('Application not found', 404);
      sa.profitLoss = body.profitLoss;
      sa.soldAt = (body && body.soldAt) || new Date().toISOString();
      /* mirror the backend: settle the person's open RECEIVED txns for this IPO */
      txns.forEach(function (t) {
        if (t.personId === sa.personId && t.ipoId === sa.ipoId && t.direction === 'RECEIVED' && !t.settled) {
          t.status = 'SETTLED_SOLD'; t.settled = true; t.settledAt = sa.soldAt;
        }
      });
      return json(withAppNames(sa));
    }

    /* reports */
    if (route === '/api/reports/send' && method === 'POST') {
      var rp = personReport(body.personId, new URLSearchParams());
      var msg = rp
        ? 'IPO Manager — ' + rp.person.name + ': held Rs.' + rp.totals.held +
          ' across ' + rp.ipos.length + ' IPO(s). (preview)'
        : 'IPO Manager report (preview)';
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
