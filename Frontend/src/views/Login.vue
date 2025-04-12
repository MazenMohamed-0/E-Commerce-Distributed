<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Login</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <login-form @login="handleLogin" />
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer></v-spacer>
            <span class="text-body-2">
              Don't have an account?
              <router-link to="/signup" class="text-primary">Sign up</router-link>
            </span>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { useUserStore } from '@/stores/user';
import LoginForm from '@/components/LoginForm.vue';

export default {
  name: 'LoginView',
  components: {
    LoginForm,
  },
  setup() {
    const userStore = useUserStore();
    return { userStore };
  },
  methods: {
    async handleLogin(credentials) {
      try {
        await this.userStore.login(credentials);
        this.$router.push('/'); // Redirect to homepage on success
      } catch (error) {
        console.error('Login failed:', error);
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