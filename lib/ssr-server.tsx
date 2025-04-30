import { Session } from "next-auth";
import { getServerSession } from "next-auth/next";

export type SsrResult = {  
  session: Session | null;
}

let useSsr = async (authOptions: any): Promise<SsrResult> => {
  const session = await getServerSession(authOptions) as Session | null;
  return { session };
};

export default useSsr;