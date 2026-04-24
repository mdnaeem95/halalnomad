export default {
  // Common
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    done: 'Done',
    loading: 'Loading...',
    signIn: 'Sign In',
    createAccount: 'Create Account',
    tryAgain: 'Try Again',
    clear: 'Clear',
    report: 'Report',
  },

  // Tab labels
  tabs: {
    explore: 'Explore',
    search: 'Search',
    add: 'Add',
    profile: 'Profile',
  },

  // Explore screen
  explore: {
    title: 'HalalNomad',
    map: 'Map',
    list: 'List',
    placesFound_one: '{{count}} Halal place found',
    placesFound_other: '{{count}} Halal places found',
    empty: 'No Halal places found.',
    emptyHint: 'Be the first to add one!',
    findingLocation: 'Finding your location...',
  },

  // Search screen
  search: {
    placeholder: 'Search Halal places...',
    empty: 'No places found.',
    emptyHint: 'Try a different search or add a new place.',
    prompt: 'Search for Halal restaurants, cafes, and more.',
  },

  // Add place screen
  addPlace: {
    signInTitle: 'Sign in to contribute',
    signInSubtitle: 'Help fellow Muslim travellers find Halal food by adding places you discover.',
    sectionDetails: 'Place Details',
    sectionCuisine: 'Cuisine Type',
    sectionPrice: 'Price Range',
    sectionPhotos: 'Photos',
    nameEn: 'Name (English) *',
    nameLocal: 'Name (Local Language)',
    addressEn: 'Address (English) *',
    addressLocal: 'Address (Local Language)',
    description: 'Description',
    hours: 'Opening Hours',
    nameEnPlaceholder: 'e.g. Halal Kitchen',
    nameLocalPlaceholder: 'e.g. 清真美食',
    addressEnPlaceholder: 'Street, City, Country',
    addressLocalPlaceholder: 'Local address for taxi drivers',
    descriptionPlaceholder: 'What should travellers know about this place?',
    hoursPlaceholder: 'e.g. Mon-Sat 11:00-22:00',
    addPhotos: 'Add Photos',
    photosSelected_one: '{{count}} photo selected',
    photosSelected_other: '{{count}} photos selected',
    submit: 'Add Place',
    submitting: 'Submitting...',
    locationNeededTitle: 'Location needed',
    locationNeededMessage: 'We need your location to place this on the map. Please enable location access.',
    successTitle: 'Place added!',
    successMessage: 'Thank you for contributing. You earned 50 points!',
    errorTitle: 'Something went wrong',
    errorMessage: 'Failed to add place. Please check your connection and try again.',
  },

  // Auth screen
  auth: {
    welcomeBack: 'Welcome back',
    joinHalalNomad: 'Join HalalNomad',
    signInSubtitle: 'Sign in to contribute and track your points.',
    signUpSubtitle: 'Help Muslim travellers find Halal food worldwide.',
    displayName: 'Display name',
    email: 'Email',
    password: 'Password',
    noAccount: "Don't have an account? Sign up",
    hasAccount: 'Already have an account? Sign in',
    checkEmail: 'Check your email',
    verificationSent: 'We sent a verification link to',
    verificationInstructions: 'Tap the link in the email to verify your account, then come back here and sign in.',
    verifiedSignIn: "I've verified — Sign me in",
    signingIn: 'Signing in...',
    backToSignIn: 'Back to sign in',
    signInFailed: 'Sign in failed',
    signUpFailed: 'Sign up failed',
    notVerifiedTitle: 'Not verified yet',
    notVerifiedMessage: 'Please check your inbox and tap the verification link first, then try again.',
  },

  // Place detail screen
  placeDetail: {
    notFound: 'Place not found.',
    verification_one: '{{count}} verification',
    verification_other: '{{count}} verifications',
    address: 'Address',
    cuisine: 'Cuisine',
    priceRange: 'Price Range',
    hoursLabel: 'Hours',
    about: 'About',
    getDirections: 'Get Directions',
    confirmHalal: 'Confirm Halal',
    reportClosed: 'Report Closed',
    reportNotHalal: 'Report Not Halal',
    signInRequired: 'Sign in required',
    signInToVerify: 'Please sign in to verify places.',
    verified: 'Halal status confirmed! +15 points',
    verifyFailed: 'Already verified or failed',
    reportConfirmTitle_closed: 'Report as closed?',
    reportConfirmTitle_notHalal: 'Report as not Halal?',
    reportConfirmMessage: 'This will be reviewed by the community. Thank you for helping keep information accurate.',
    reportSubmitted: 'Report submitted. +10 points',
    reportFailed: 'Failed to report',
    addressCopied: 'Address copied to clipboard',
    reviews: 'Reviews ({{count}})',
    noReviews: 'No reviews yet. Be the first!',
  },

  // Profile screen
  profile: {
    joinTitle: 'Join the community',
    joinSubtitle: 'Sign in to add places, verify Halal status, earn points, and help Muslim travellers worldwide.',
    contributorPoints: 'Contributor Points',
    pointsToNextTier: '{{points}} points to {{tier}}',
    howToEarn: 'How to earn points',
    earnAddPlace: 'Add a new place',
    earnCertificate: 'Upload Halal certificate',
    earnReview: 'Write a review',
    earnVerify: 'Confirm Halal status',
    earnPhoto: 'Upload a photo',
    earnReport: 'Report a place',
    signOut: 'Sign Out',
  },

  // Report warning component
  reportWarning: {
    noReports: 'No recent reports',
    noReportsWithVerifications_one: 'No reports · {{count}} verification',
    noReportsWithVerifications_other: 'No reports · {{count}} verifications',
    mayClosed: '{{pct}}% may be closed',
    halalDisputed: '{{pct}}% halal disputed',
    communityReports: 'Community Reports',
    possiblyClosed: 'Possibly closed',
    halalStatusDisputed: 'Halal status disputed',
    disclaimer_one: 'Based on {{count}} community report. Verify on arrival.',
    disclaimer_other: 'Based on {{count}} community reports. Verify on arrival.',
    report_one: '{{count}} report',
    report_other: '{{count}} reports',
  },

  // Paywall
  paywall: {
    title: 'HalalNomad Premium',
    subtitle: 'Unlock the full experience for Muslim travellers worldwide.',
    features: {
      offlineMaps: {
        title: 'Offline City Maps',
        desc: 'Download cities for offline access — essential for travellers with limited data.',
      },
      advancedFilters: {
        title: 'Advanced Filters',
        desc: 'Filter by zabihah-only, no-alcohol venues, and dietary sub-preferences.',
      },
      tripPlanning: {
        title: 'Trip Planning',
        desc: 'Save places to custom lists and share with travel companions.',
      },
      adFree: {
        title: 'Ad-Free Experience',
        desc: 'Browse without any advertisements.',
      },
      prioritySupport: {
        title: 'Priority Support',
        desc: 'Get faster responses from our team when you need help.',
      },
    },
    bestValue: 'Best Value',
    yearlyTitle: 'Yearly',
    yearlyDesc: 'Save 50% compared to monthly',
    monthlyTitle: 'Monthly',
    monthlyDesc: 'Cancel anytime',
    subscribe: 'Subscribe Now',
    restore: 'Restore Purchases',
    successTitle: 'Welcome to Premium!',
    successMessage: 'Thank you for supporting HalalNomad. All premium features are now unlocked.',
    errorTitle: 'Purchase failed',
    errorMessage: 'Something went wrong. Please try again or contact support.',
    restored: 'Subscription restored!',
    noSubscription: 'No previous subscription found.',
    legal: 'Payment is charged to your {{store}} account. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.',
  },

  // Featured listing
  featured: {
    badge: 'Featured',
  },

  // Error boundary
  error: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },

  // Offline banner
  offline: {
    message: "You're offline. Showing cached data.",
  },

  // Cuisine types
  cuisines: {
    chinese_muslim: 'Chinese Muslim',
    middle_eastern: 'Middle Eastern',
    turkish: 'Turkish',
    indian: 'Indian',
    pakistani: 'Pakistani',
    indonesian: 'Indonesian',
    malaysian: 'Malaysian',
    african: 'African',
    central_asian: 'Central Asian',
    japanese: 'Japanese',
    korean: 'Korean',
    thai: 'Thai',
    mediterranean: 'Mediterranean',
    western: 'Western',
    other: 'Other',
  },

  // Halal levels
  halalLevels: {
    reported: 'Reported',
    communityVerified: 'Community Verified',
    photoVerified: 'Photo Verified',
    trusted: 'Trusted',
  },

  // Contributor tiers
  tiers: {
    explorer: 'Explorer',
    guide: 'Guide',
    ambassador: 'Ambassador',
    legend: 'Legend',
  },
} as const;
