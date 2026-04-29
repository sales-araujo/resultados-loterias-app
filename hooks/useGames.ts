"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Game, GameInsert } from "@/lib/types";
import { toast } from "sonner";

export function useGames(tipoJogo?: string) {
  const queryClient = useQueryClient();

  const gamesQuery = useQuery({
    queryKey: ["games", tipoJogo],
    queryFn: async (): Promise<Game[]> => {
      let query = supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false });

      if (tipoJogo) {
        query = query.eq("tipo_jogo", tipoJogo);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase query error:", error.message, error.code);
        throw error;
      }
      return (data as Game[]) || [];
    },
    retry: false,
  });

  const createGame = useMutation({
    mutationFn: async (game: GameInsert) => {
      const { data, error } = await supabase
        .from("games")
        .insert({
          ...game,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success("Jogo cadastrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar jogo: ${error.message}`);
    },
  });

  const updateGame = useMutation({
    mutationFn: async ({
      id,
      ...game
    }: Partial<Game> & { id: string }) => {
      const { data, error } = await supabase
        .from("games")
        .update({
          ...game,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success("Jogo atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar jogo: ${error.message}`);
    },
  });

  const deleteGame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success("Jogo excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir jogo: ${error.message}`);
    },
  });

  return {
    games: gamesQuery.data || [],
    isLoading: gamesQuery.isLoading,
    error: gamesQuery.error,
    createGame,
    updateGame,
    deleteGame,
    refetch: gamesQuery.refetch,
  };
}
