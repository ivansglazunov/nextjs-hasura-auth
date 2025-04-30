import { Session } from "next-auth";

export type SsrResult = {
  session: Session | null;
}

// Client version always returns null synchronously
const useSsr = (): SsrResult => {
  return { session: null };
};

export default useSsr; 