"use client";
export function AuthPage({isSignIn}: {isSignIn: boolean}) {
    return (
        <div className="w-screen h-screen flex justify-center items-center">
            <div className="p-4 m-4 bg-white rounded">
                <input type="text" placeholder="Email" className="p-2 m-4" />
                <input type="password" placeholder="Password" />

                <button
                    onClick={() => {
                        //todo add axios and complete
                    }}
                >
                    {isSignIn ? "Sign in" : "Sign up"}
                </button>
            </div>
        </div>
    );
}
//make landing page from bolt
//add shadcn comps
//add generic components from @repo/ui
//complete the signin and signup components