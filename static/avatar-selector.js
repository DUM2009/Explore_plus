/**
 * Shared "which mascot did the student pick" resolver.
 *
 * The profile page's avatar picker persists a short id (not a full URL) so
 * that every page — profile, mission lessons, the missions index — can
 * independently resolve the same choice to whichever local static path that
 * page defines in window.exploreAvatarOptions. This is what makes picking a
 * new avatar on the profile page automatically propagate to the help-FAB
 * mascot and the AI chat mascot elsewhere: they all read this same key.
 */
(function () {
    const DEFAULT_AVATAR_ID = 'biology';

    function getStorageKey() {
        return `explore_avatar_id_uid:django-${window.exploreUserId}`;
    }

    function getSelectedAvatarId() {
        try {
            return localStorage.getItem(getStorageKey()) || DEFAULT_AVATAR_ID;
        } catch {
            return DEFAULT_AVATAR_ID;
        }
    }

    function getSelectedAvatarUrl() {
        const options = window.exploreAvatarOptions || {};
        const id = getSelectedAvatarId();
        return options[id] || options[DEFAULT_AVATAR_ID] || '';
    }

    function setSelectedAvatarId(id) {
        try {
            localStorage.setItem(getStorageKey(), id);
        } catch {
            // Ignore storage failures (private browsing, quota, etc.).
        }
    }

    window.ExploreAvatar = {
        getSelectedAvatarId,
        getSelectedAvatarUrl,
        setSelectedAvatarId,
    };
})();
