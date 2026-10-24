export type ClasseUsuario = "admin" | "funcionario" | "cliente";

export const nomesClasses: Record<ClasseUsuario, string> = {
  cliente: "Cliente",
  funcionario: "Funcionário",
  admin: "Administrador",
};

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  classe: ClasseUsuario;
}
