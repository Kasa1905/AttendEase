const ACCESS_KEY = 'club_access_token';
const REFRESH_KEY = 'club_refresh_token';

function storageFor(persistent) {
	return persistent ? localStorage : sessionStorage;
}

export function saveTokens({ accessToken, refreshToken }, persistent = true){
	const s = storageFor(persistent);
	const other = storageFor(!persistent);
	if (accessToken) s.setItem(ACCESS_KEY, accessToken);
	else s.removeItem(ACCESS_KEY);
	if (refreshToken) s.setItem(REFRESH_KEY, refreshToken);
	else s.removeItem(REFRESH_KEY);
	// remove from the other storage to avoid conflicts
	other.removeItem(ACCESS_KEY);
	other.removeItem(REFRESH_KEY);
}
export function getAccessToken(){ return localStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(ACCESS_KEY); }
export function getRefreshToken(){ return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY); }
export function clearTokens(){ localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(REFRESH_KEY); }
