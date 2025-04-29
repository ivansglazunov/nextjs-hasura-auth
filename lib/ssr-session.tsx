import { Session } from "next-auth";
import { getServerSession } from "next-auth/next"

let getSsrSession: (authOptions: any) => Promise<Session | null>;

if (process.env.NEXT_PUBLIC_BUILD_TARGET === 'server') {
  getSsrSession = async (authOptions: any) => {
    return await getServerSession(authOptions);
  };
} else {
  getSsrSession = async (authOptions: any) => {
    return null;
  };
}

export default getSsrSession;