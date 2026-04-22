import {HTTP_BACKEND} from "../../config";
import {apiClient} from "./apiClient";
import {AxiosError} from "axios";

export async function ensureAuthenticated(redirectTo: string): Promise<boolean> {
    try {
        await apiClient.get(`${HTTP_BACKEND}/auth/current-user`);
        return true;
    } catch (errorResponse) {
        const axiosError = errorResponse as AxiosError;
        const status = axiosError.response?.status;

        if (status === 401) {
            try {
                await apiClient.post(`${HTTP_BACKEND}/auth/refresh-token`, {});
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

        // For non-auth failures (network/transient backend errors), do not force logout.
        return false;
    }
}

export async function logoutUser(): Promise<void> {
    await apiClient.post(`${HTTP_BACKEND}/auth/logout`);
}