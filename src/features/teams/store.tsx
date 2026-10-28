"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { Team } from "./types";

type TeamStoreState = {
  teams: Team[];
  loading: boolean;
};

type Action =
  | { type: "hydrateTeams"; teams: Team[] }
  | { type: "updateTeam"; teamId: string; patch: Partial<Team> }
  | { type: "removeTeam"; teamId: string }
  | { type: "addTeam"; team: Team };

const initialState: TeamStoreState = { teams: [], loading: false };

function reducer(state: TeamStoreState, action: Action): TeamStoreState {
  switch (action.type) {
    case "hydrateTeams":
      return { ...state, teams: action.teams, loading: false };
    case "updateTeam":
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId ? { ...t, ...action.patch } : t
        ),
      };
    case "removeTeam":
      return { ...state, teams: state.teams.filter((t) => t.id !== action.teamId) };
    case "addTeam":
      return { ...state, teams: [...state.teams, action.team] };
    default:
      return state;
  }
}

type TeamStoreContextValue = {
  state: TeamStoreState;
  hydrateTeams: (teams: Team[]) => void;
  updateTeam: (teamId: string, patch: Partial<Team>) => void;
  removeTeam: (teamId: string) => void;
  addTeam: (team: Team) => void;
};

export const TeamStoreContext = createContext<TeamStoreContextValue | null>(null);

export const TeamStoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydrateTeams = useCallback((teams: Team[]) => dispatch({ type: "hydrateTeams", teams }), []);
  const updateTeam = useCallback((teamId: string, patch: Partial<Team>) => dispatch({ type: "updateTeam", teamId, patch }), []);
  const removeTeam = useCallback((teamId: string) => dispatch({ type: "removeTeam", teamId }), []);
  const addTeam = useCallback((team: Team) => dispatch({ type: "addTeam", team }), []);
  const value = useMemo(() => ({ state, hydrateTeams, updateTeam, removeTeam, addTeam }), [state, hydrateTeams, updateTeam, removeTeam, addTeam]);
  return <TeamStoreContext.Provider value={value}>{children}</TeamStoreContext.Provider>;
};

export const useTeamStore = () => {
  const ctx = useContext(TeamStoreContext);
  if (!ctx) throw new Error("useTeamStore must be inside TeamStoreProvider");
  return ctx;
};

export const useOptionalTeamStore = () => {
  return useContext(TeamStoreContext);
};

export const getTeamForAgent = (teams: Team[], teamId: string | null | undefined): Team | null => {
  if (!teamId) return null;
  return teams.find((t) => t.id === teamId) ?? null;
};

export const isAgentInDisabledTeam = (teams: Team[], teamId: string | null | undefined): boolean => {
  const team = getTeamForAgent(teams, teamId);
  return team !== null && !team.enabled;
};
