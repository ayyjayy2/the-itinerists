// Staging build (`ng build --configuration staging`): the-itinerists-staging,
// a separate Firebase project with its own data and accounts. Committed on
// purpose: a web config is public in every deployed bundle, and CI builds
// staging without secrets. No App Check and no Google Analytics on staging.
export const environment = {
  production: true,
  firebase: {
    apiKey:            'AIzaSyDIn_Ds44FTB5YEEAx4rxL_M6Xztprn6GY',
    authDomain:        'the-itinerists-staging.firebaseapp.com',
    projectId:         'the-itinerists-staging',
    storageBucket:     'the-itinerists-staging.firebasestorage.app',
    messagingSenderId: '165808904063',
    appId:             '1:165808904063:web:fe6edff38122c02b96ac4a',
    measurementId:     '',
  },
  recaptchaSiteKey: '',
  appCheckDebugToken: '',
};
