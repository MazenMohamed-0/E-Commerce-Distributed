<template>
  <v-form ref="form" v-model="valid" lazy-validation>
    <v-text-field
      v-model="userData.name"
      label="Full Name"
      :rules="[rules.required]"
      required
      prepend-icon="mdi-account"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-text-field
      v-model="userData.email"
      label="Email"
      :rules="[rules.required, rules.email]"
      required
      prepend-icon="mdi-email"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-text-field
      v-model="userData.password"
      label="Password"
      :type="showPassword ? 'text' : 'password'"
      :rules="[rules.required, rules.min]"
      required
      prepend-icon="mdi-lock"
      :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
      @click:append-inner="togglePasswordVisibility"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-btn
      :disabled="!valid"
      color="primary"
      block
      @click="submit"
    >
      Sign Up
    </v-btn>
  </v-form>
</template>

<script>
export default {
  name: 'SignupForm',
  data() {
    return {
      valid: false,
      showPassword: false,
      userData: {
        name: '',
        email: '',
        password: '',
      },
      rules: {
        required: (value) => !!value || 'Required.',
        email: (value) => /.+@.+\..+/.test(value) || 'E-mail must be valid.',
        min: (value) => (value && value.length >= 6) || 'Min 6 characters.',
      },
    };
  },
  methods: {
    togglePasswordVisibility() {
      this.showPassword = !this.showPassword;
    },
    submit() {
      this.$emit('signup', this.userData);
    },
  },
};
</script>