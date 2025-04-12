<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Sign Up</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <signup-form @signup="handleSignup" />
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer></v-spacer>
            <span class="text-body-2">
              Already have an account?
              <router-link to="/login" class="text-primary">Login</router-link>
            </span>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { useUserStore } from '@/stores/user';
import SignupForm from '@/components/SignupForm.vue';

export default {
  name: 'SignupView',
  components: {
    SignupForm,
  },
  setup() {
    const userStore = useUserStore();
    return { userStore };
  },
  methods: {
    async handleSignup(userData) {
      try {
        await this.userStore.signup(userData);
        this.$router.push('/'); // Redirect to homepage on success
      } catch (error) {
        console.error('Signup failed:', error);
      }
    },
  },
};
</script>

<style scoped>
.v-card {
  border-radius: 8px;
}
</style>