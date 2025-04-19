const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

// Debug logging
console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID);
console.log('Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '***' : 'undefined');
console.log('Facebook App ID:', process.env.FACEBOOK_APP_ID);
console.log('Facebook App Secret:', process.env.FACEBOOK_APP_SECRET ? '***' : 'undefined');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3001/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ oauthId: profile.id, oauthProvider: 'google' });

    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        // Link existing account with OAuth
        user.oauthId = profile.id;
        user.oauthProvider = 'google';
        await user.save();
      } else {
        // Create new user
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          oauthId: profile.id,
          oauthProvider: 'google',
          role: 'buyer'
        });
      }
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Facebook OAuth Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: 'http://localhost:3001/auth/facebook/callback',
  profileFields: ['id', 'emails', 'name', 'displayName'],
  enableProof: true,
  state: true,
  scope: ['email', 'public_profile'],
  authType: 'reauthenticate',
  display: 'popup'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ oauthId: profile.id, oauthProvider: 'facebook' });

    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        // Link existing account with OAuth
        user.oauthId = profile.id;
        user.oauthProvider = 'facebook';
        await user.save();
      } else {
        // Create new user
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          oauthId: profile.id,
          oauthProvider: 'facebook',
          role: 'buyer'
        });
      }
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport; 