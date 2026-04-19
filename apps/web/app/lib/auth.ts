import {HTTP_BACKEND} from "../../config";
import {apiClient} from "./apiClient";

export async function ensureAuthenticated(redirectTo: string): Promise<boolean> {
    try {
        await apiClient.get(`${HTTP_BACKEND}/auth/current-user`);
        return true;
    } catch {
        if (typeof window !== "undefined") {
            const redirectTarget = encodeURIComponent(redirectTo);
            window.location.href = `/signin?redirect=${redirectTarget}`;
        }

        return false;
    }
}

export async function logoutUser(): Promise<void> {
    await apiClient.post(`${HTTP_BACKEND}/auth/logout`);
}