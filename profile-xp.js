const LEVEL_XP_STEP = 100;
const PROFILE_STORAGE_PREFIX = 'explore_profile_';
const PROFILE_UPDATE_EVENT = 'explore:profile-updated';
const BADGE_DEFINITIONS = Object.freeze([
    {
        id: 'photosynthesis',
        name: 'Fotossíntese',
        topic: 'Fotossíntese',
        tone: 'Prateado',
        icon: 'assets/images/Emblema prateado fotossíntese.jpg',
        description: 'Completa o quiz de Fotossíntese para desbloquear este emblema.',
        unlockSources: ['photosynthesis-goldtest', 'photosynthesis:final-quiz']
    },
    {
        id: 'dna',
        name: 'DNA',
        topic: 'DNA',
        tone: 'Prateado',
        icon: 'assets/images/badges/dna-silver.svg',
        description: 'Completa o quiz de DNA para desbloquear este emblema.',
        unlockSources: ['dna:code-of-life', 'dna-genetic-code']
    },
    {
        id: 'mitosis',
        name: 'Mitose',
        topic: 'Mitose',
        tone: 'Prateado',
        icon: 'assets/images/badges/mitosis-silver.svg',
        description: 'Completa o quiz de Mitose para desbloquear este emblema.',
        unlockSources: ['mitosis']
    }
]);
const PROFILE_RANKS = Object.freeze([
    { minLevel: 0, title: 'Aprendiz' },
    { minLevel: 1, title: 'Explorador' },
    { minLevel: 3, title: 'Investigador' },
    { minLevel: 5, title: 'Guardião da Vida' }
]);

function normalizeXPValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }

    return Math.floor(parsed);
}

function sanitizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function createDefaultBadges() {
    return BADGE_DEFINITIONS.reduce((badges, badge) => {
        badges[badge.id] = { unlocked: false };
        return badges;
    }, {});
}

function sanitizeBadges(rawBadges) {
    const safeBadges = sanitizeObject(rawBadges);
    const normalizedBadges = createDefaultBadges();

    BADGE_DEFINITIONS.forEach((badge) => {
        const rawBadge = safeBadges[badge.id];
        normalizedBadges[badge.id] = {
            unlocked: rawBadge === true || rawBadge?.unlocked === true
        };
    });

    return normalizedBadges;
}

function sanitizeProfile(rawProfile) {
    const profile = sanitizeObject(rawProfile);

    return {
        xp: normalizeXPValue(profile.xp),
        awardedSources: sanitizeObject(profile.awardedSources),
        migrations: sanitizeObject(profile.migrations),
        badges: sanitizeBadges(profile.badges)
    };
}

function getUserStorageKey(user) {
    if (user?.uid) {
        return `uid:${user.uid}`;
    }

    if (user?.email) {
        return `email:${String(user.email).toLowerCase()}`;
    }

    return 'guest';
}

function getProfileStorageKey(user) {
    return `${PROFILE_STORAGE_PREFIX}${getUserStorageKey(user)}`;
}

function getLevelFromXP(xp) {
    return Math.floor(normalizeXPValue(xp) / LEVEL_XP_STEP);
}

function getNextLevelThreshold(xp) {
    return (getLevelFromXP(xp) + 1) * LEVEL_XP_STEP;
}

function getProgressInCurrentLevel(xp) {
    return normalizeXPValue(xp) % LEVEL_XP_STEP;
}

function getProgressPercent(xp) {
    return (getProgressInCurrentLevel(xp) / LEVEL_XP_STEP) * 100;
}

function getProfileStats(profile) {
    const safeProfile = sanitizeProfile(profile);
    const level = getLevelFromXP(safeProfile.xp);

    return {
        xp: safeProfile.xp,
        level,
        nextLevelThreshold: getNextLevelThreshold(safeProfile.xp),
        progressInLevel: getProgressInCurrentLevel(safeProfile.xp),
        progressPercent: getProgressPercent(safeProfile.xp)
    };
}

function safelyParseJSON(rawValue) {
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        console.warn('Could not parse stored JSON data:', error);
        return null;
    }
}

function getLegacyMissionXP(storage) {
    if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') {
        return 0;
    }

    let totalXP = 0;

    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith('mission_')) {
            continue;
        }

        const missionProgress = safelyParseJSON(storage.getItem(key));
        if (!missionProgress) {
            continue;
        }

        totalXP += normalizeXPValue(missionProgress.earnedXP);
    }

    return totalXP;
}

function migrateLegacyMissionXP(profile, storage) {
    const safeProfile = sanitizeProfile(profile);

    if (safeProfile.migrations.legacyMissionXpImported) {
        return { profile: safeProfile, changed: false };
    }

    const migratedXP = getLegacyMissionXP(storage);
    const nextProfile = {
        ...safeProfile,
        xp: safeProfile.xp + migratedXP,
        migrations: {
            ...safeProfile.migrations,
            legacyMissionXpImported: true
        }
    };

    return {
        profile: nextProfile,
        changed: migratedXP > 0
    };
}

function readProfile(storage, user) {
    const key = getProfileStorageKey(user);
    const storedProfile = sanitizeProfile(safelyParseJSON(storage?.getItem?.(key)));
    const migration = migrateLegacyMissionXP(storedProfile, storage);

    if (migration.changed) {
        writeProfile(storage, user, migration.profile);
    }

    return migration.profile;
}

function writeProfile(storage, user, profile) {
    if (!storage?.setItem) {
        return;
    }

    storage.setItem(getProfileStorageKey(user), JSON.stringify(sanitizeProfile(profile)));
}

function buildRewardSource(type, identifier) {
    return `${type}:${identifier}`;
}

function normalizeSource(source) {
    return String(source || '').trim().toLowerCase();
}

function matchesBadgeUnlockSource(badge, source) {
    return badge.unlockSources.some((unlockSource) => source.includes(unlockSource.toLowerCase()));
}

function unlockBadgesForSource(profile, source) {
    const safeProfile = sanitizeProfile(profile);
    const normalizedSource = normalizeSource(source);

    if (!normalizedSource) {
        return {
            profile: safeProfile,
            changed: false,
            unlockedBadges: []
        };
    }

    const nextBadges = { ...safeProfile.badges };
    const unlockedBadges = [];

    BADGE_DEFINITIONS.forEach((badge) => {
        if (!matchesBadgeUnlockSource(badge, normalizedSource) || nextBadges[badge.id]?.unlocked) {
            return;
        }

        nextBadges[badge.id] = { unlocked: true };
        unlockedBadges.push(badge.id);
    });

    if (!unlockedBadges.length) {
        return {
            profile: safeProfile,
            changed: false,
            unlockedBadges
        };
    }

    return {
        profile: {
            ...safeProfile,
            badges: nextBadges
        },
        changed: true,
        unlockedBadges
    };
}

function awardXP(profile, amount, source) {
    const safeProfile = sanitizeProfile(profile);
    const normalizedAmount = normalizeXPValue(amount);

    if (!normalizedAmount) {
        return {
            profile: safeProfile,
            awarded: false,
            xpAdded: 0
        };
    }

    if (source && safeProfile.awardedSources[source]) {
        return {
            profile: safeProfile,
            awarded: false,
            xpAdded: 0
        };
    }

    const nextProfile = {
        ...safeProfile,
        xp: safeProfile.xp + normalizedAmount,
        awardedSources: source
            ? { ...safeProfile.awardedSources, [source]: true }
            : { ...safeProfile.awardedSources }
    };

    return {
        profile: nextProfile,
        awarded: true,
        xpAdded: normalizedAmount
    };
}

function announceProfileUpdate(user, profile) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
        return;
    }

    window.dispatchEvent(new CustomEvent(PROFILE_UPDATE_EVENT, {
        detail: {
            userKey: getUserStorageKey(user),
            profile: sanitizeProfile(profile),
            stats: getProfileStats(profile)
        }
    }));
}

function getDefaultStorage(storage) {
    if (storage) {
        return storage;
    }

    return typeof localStorage !== 'undefined' ? localStorage : null;
}

function commitProfileUpdate(user, profile, storage) {
    writeProfile(storage, user, profile);
    announceProfileUpdate(user, profile);
}

function awardXPToUser(user, amount, source, storage) {
    const resolvedStorage = getDefaultStorage(storage);
    const currentProfile = readProfile(resolvedStorage, user);
    const result = awardXP(currentProfile, amount, source);
    const badgeResult = unlockBadgesForSource(result.profile, source);
    const nextProfile = badgeResult.profile;

    if (result.awarded || badgeResult.changed) {
        commitProfileUpdate(user, nextProfile, resolvedStorage);
    }

    return {
        ...result,
        profile: nextProfile,
        unlockedBadges: badgeResult.unlockedBadges
    };
}

function unlockBadgesForUser(user, source, storage) {
    const resolvedStorage = getDefaultStorage(storage);
    const currentProfile = readProfile(resolvedStorage, user);
    const result = unlockBadgesForSource(currentProfile, source);

    if (result.changed) {
        commitProfileUpdate(user, result.profile, resolvedStorage);
    }

    return result;
}

function getCurrentUser() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.exploreCurrentUser || null;
}

function getCurrentUserProfile(storage) {
    return readProfile(getDefaultStorage(storage), getCurrentUser());
}

function awardXPToCurrentUser(amount, source, storage) {
    return awardXPToUser(getCurrentUser(), amount, source, getDefaultStorage(storage));
}

function unlockBadgesForCurrentUser(source, storage) {
    return unlockBadgesForUser(getCurrentUser(), source, getDefaultStorage(storage));
}

function getBadgeCatalog(profile) {
    const safeProfile = sanitizeProfile(profile);

    return BADGE_DEFINITIONS.map((badge) => ({
        ...badge,
        unlocked: safeProfile.badges[badge.id]?.unlocked === true
    }));
}

function getRankFromLevel(level) {
    const safeLevel = Math.max(0, Number(level) || 0);
    let currentRank = PROFILE_RANKS[0];

    PROFILE_RANKS.forEach((rank) => {
        if (safeLevel >= rank.minLevel) {
            currentRank = rank;
        }
    });

    return currentRank.title;
}

function getNextRank(level) {
    const safeLevel = Math.max(0, Number(level) || 0);
    return PROFILE_RANKS.find((rank) => rank.minLevel > safeLevel) || null;
}

function getCurrentSubject(profile) {
    const safeProfile = sanitizeProfile(profile);
    const awardedSources = Object.keys(safeProfile.awardedSources).map(normalizeSource);
    const activeBadge = [...BADGE_DEFINITIONS].reverse().find((badge) => (
        safeProfile.badges[badge.id]?.unlocked
        || awardedSources.some((source) => matchesBadgeUnlockSource(badge, source))
    ));

    return activeBadge ? activeBadge.topic : 'Fotossíntese';
}

function getRemainingUnlockables(profile) {
    const safeProfile = sanitizeProfile(profile);
    const stats = getProfileStats(safeProfile);
    const lockedBadges = getBadgeCatalog(safeProfile)
        .filter((badge) => !badge.unlocked)
        .map((badge) => ({
            type: 'badge',
            id: badge.id,
            label: `${badge.name} ${badge.tone}`,
            description: badge.description
        }));
    const nextRank = getNextRank(stats.level);

    if (!nextRank) {
        return lockedBadges;
    }

    return [
        {
            type: 'rank',
            id: `rank-${nextRank.minLevel}`,
            label: nextRank.title,
            description: `Atinge o nível ${nextRank.minLevel} para desbloquear o próximo título.`
        },
        ...lockedBadges
    ];
}

function getProfileOverview(profile) {
    const safeProfile = sanitizeProfile(profile);
    const stats = getProfileStats(safeProfile);

    return {
        stats,
        rank: getRankFromLevel(stats.level),
        currentSubject: getCurrentSubject(safeProfile),
        badges: getBadgeCatalog(safeProfile),
        remainingUnlockables: getRemainingUnlockables(safeProfile)
    };
}

const ProfileXP = {
    LEVEL_XP_STEP,
    PROFILE_UPDATE_EVENT,
    BADGE_DEFINITIONS,
    PROFILE_RANKS,
    getProfileStorageKey,
    getLevelFromXP,
    getProfileStats,
    readProfile,
    buildRewardSource,
    awardXPToUser,
    unlockBadgesForUser,
    getCurrentUserProfile,
    awardXPToCurrentUser,
    unlockBadgesForCurrentUser,
    getBadgeCatalog,
    getRankFromLevel,
    getCurrentSubject,
    getRemainingUnlockables,
    getProfileOverview
};

if (typeof window !== 'undefined') {
    window.ProfileXP = ProfileXP;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileXP;
}
