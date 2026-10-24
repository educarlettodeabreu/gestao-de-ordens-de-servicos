import { createBrowserRouter, RouterProvider } from "react-router";
import { rotas } from "./routes/rotas.tsx";

const router = createBrowserRouter(rotas);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
