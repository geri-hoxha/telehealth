import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { profileApi, type ProfileUpdate } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import type { Sex } from '@/api/types';
import { useAuth, useUser } from '@/auth/AuthProvider';
import {
  AppText,
  Avatar,
  Button,
  ChipGroup,
  Header,
  Screen,
  TextField,
  useActionSheet,
  useSnackbar,
  type ActionSheetOption,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

/** Edit personal info and photo; doctors also their professional details. */
export default function EditProfileScreen() {
  const user = useUser();
  const { setUser } = useAuth();
  const { t } = useI18n();
  const showSnackbar = useSnackbar();
  const showActionSheet = useActionSheet();
  const isDoctor = user.role === 'DOCTOR';
  const profile = user.doctorProfile;

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [sex, setSex] = useState<Sex | null>(user.sex);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [licenceNumber, setLicenceNumber] = useState(profile?.licenceNumber ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [healthCentre, setHealthCentre] = useState(profile?.healthCentre ?? '');
  const [submitted, setSubmitted] = useState(false);

  const phoneValid = !phone.trim() || /^\+?[0-9 ]{6,20}$/.test(phone.trim());

  const save = useMutation({
    mutationFn: () => {
      const changes: ProfileUpdate = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        ...(sex ? { sex } : {}),
        ...(isDoctor ? { bio, licenceNumber, country, city, healthCentre } : {}),
      };
      return profileApi.update(changes);
    },
    onSuccess: (updated) => {
      setUser(updated);
      showSnackbar({ message: t('editProfile.saved'), tone: 'success' });
      router.back();
    },
  });

  const photo = useMutation({
    mutationFn: (asset: { uri: string; mimeType?: string } | null) =>
      asset ? profileApi.uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg') : profileApi.removeAvatar(),
    onSuccess: setUser,
    onError: (error) => showSnackbar({ message: errorMessage(error, t), tone: 'error' }),
  });

  const pick = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('editProfile.changePhoto'), source === 'camera' ? t('editProfile.cameraDenied') : t('editProfile.photosDenied'));
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (!result.canceled && asset) photo.mutate({ uri: asset.uri, mimeType: asset.mimeType });
  };

  const choosePhoto = () => {
    const options: ActionSheetOption[] = [
      { label: t('editProfile.takePhoto'), icon: 'camera', onPress: () => void pick('camera') },
      { label: t('editProfile.choosePhoto'), icon: 'images', onPress: () => void pick('library') },
    ];
    if (user.avatarUrl) {
      options.push({ label: t('editProfile.removePhoto'), icon: 'trash', destructive: true, onPress: () => photo.mutate(null) });
    }
    showActionSheet({ title: t('editProfile.changePhoto'), options });
  };

  const submit = () => {
    setSubmitted(true);
    if (firstName.trim() && lastName.trim() && phoneValid) save.mutate();
  };

  return (
    <Screen
      keyboard
      header={<Header title={t('editProfile.title')} />}
      footer={<Button label={t('common.save')} icon="checkmark" onPress={submit} loading={save.isPending} />}
    >
      <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel={t('editProfile.changePhoto')} style={styles.photo}>
        <View>
          <Avatar name={`${firstName} ${lastName}`} url={user.avatarUrl} size={104} />
          <View style={styles.camera}>
            {photo.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="camera" size={18} color={colors.white} />}
          </View>
        </View>
        <AppText variant="caption" weight="700" color={colors.primary}>
          {t('editProfile.changePhoto')}
        </AppText>
      </Pressable>

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label={t('signUp.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            error={submitted && !firstName.trim() ? t('common.required') : undefined}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('signUp.lastName')}
            value={lastName}
            onChangeText={setLastName}
            error={submitted && !lastName.trim() ? t('common.required') : undefined}
          />
        </View>
      </View>
      <TextField label={t('auth.email')} icon="mail-outline" value={user.email} editable={false} hint={t('editProfile.emailHint')} />
      <TextField
        label={t('signUp.phone')}
        icon="call-outline"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        error={submitted && !phoneValid ? t('signUp.phoneInvalid') : undefined}
      />
      {user.personalId ? (
        <TextField label={t('signUp.personalId')} icon="card-outline" value={user.personalId} editable={false} />
      ) : null}
      <View style={styles.field}>
        <AppText variant="caption" weight="600" color={colors.textSecondary}>
          {t('signUp.sex')}
        </AppText>
        <ChipGroup<Sex>
          options={[
            { value: 'FEMALE', label: t('sex.FEMALE'), icon: 'female' },
            { value: 'MALE', label: t('sex.MALE'), icon: 'male' },
          ]}
          value={sex}
          onChange={setSex}
        />
      </View>

      {isDoctor ? (
        <>
          <AppText variant="overline" color={colors.textMuted} style={styles.section}>
            {t('editProfile.professional')}
          </AppText>
          <TextField label={t('editProfile.bio')} value={bio} onChangeText={setBio} multiline maxLength={2000} />
          <TextField label={t('editProfile.licenceNumber')} icon="ribbon-outline" value={licenceNumber} onChangeText={setLicenceNumber} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label={t('editProfile.country')} value={country} onChangeText={setCountry} />
            </View>
            <View style={styles.flex}>
              <TextField label={t('editProfile.city')} value={city} onChangeText={setCity} />
            </View>
          </View>
          <TextField label={t('editProfile.healthCentre')} icon="business-outline" value={healthCentre} onChangeText={setHealthCentre} />
        </>
      ) : null}

      {save.isError ? (
        <AppText variant="caption" color={colors.danger} align="center">
          {errorMessage(save.error, t)}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  photo: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md - 4,
  },
  field: {
    gap: spacing.sm,
  },
  section: {
    marginTop: spacing.sm,
  },
});
