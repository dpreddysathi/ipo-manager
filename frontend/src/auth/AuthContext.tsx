import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  getAuthToken,
  setAuthToken,
  setOnUnauthorized,
} from '../api';
import type { AuthUser, LoginInput, RegisterInput } from '../types';

interface AuthState {
  user: AuthUser | null;
  /** False until a saved session has been checked against /api/auth/me. */
  ready: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Any 401 from a protected endpoint drops the session; the route
    // guard below then bounces the user to /login.
    setOnUnauthorized(() => logout());
    // Restore a saved session when the token is still valid.
    if (getAuthToken()) {
      api
        .me()
        .then(setUser)
        .catch(() => setAuthToken(null))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [logout]);

  const applySession = useCallback((res: AuthUser & { token: string }) => {
    setAuthToken(res.token);
    setUser({ id: res.id, name: res.name, email: res.email });
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      applySession(await api.login(input));
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      applySession(await api.register(input));
    },
    [applySession],
  );

  return (
    <Ctx.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
