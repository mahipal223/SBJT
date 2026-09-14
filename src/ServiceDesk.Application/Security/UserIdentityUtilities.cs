using System.Security.Cryptography;
using System.Text;

namespace ServiceDesk.Application.Security;

/// <summary>
/// Utility functions for extracting and deriving stable GUIDs from user identity subjects.
/// </summary>
public static class UserIdentityUtilities
{
    private static readonly Guid DnsNamespace = new("6ba7b810-9dad-11d1-80b4-00c04fd430c8");

    /// <summary>
    /// Derives a stable Guid from an Auth0 or OIDC subject string.
    /// Auth0 subjects look like "auth0|uuid" or "google-oauth2|102938475".
    /// If the subject already contains a valid GUID, it is returned directly.
    /// Otherwise, a deterministic GUID is derived from the subject bytes.
    /// </summary>
    public static Guid DeriveUserId(string subject)
    {
        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new ArgumentException("Subject cannot be null or empty.", nameof(subject));
        }

        if (Guid.TryParse(subject, out var directGuid))
        {
            return directGuid;
        }

        var parts = subject.Split('|');
        if (parts.Length == 2 && Guid.TryParse(parts[1], out var embedded))
        {
            return embedded;
        }

        return CreateDeterministicGuid(DnsNamespace, subject);
    }

    private static Guid CreateDeterministicGuid(Guid namespaceId, string name)
    {
        var namespaceBytes = namespaceId.ToByteArray();
        SwapByteOrder(namespaceBytes);

        var nameBytes = Encoding.UTF8.GetBytes(name);
        var buffer = new byte[namespaceBytes.Length + nameBytes.Length];
        Buffer.BlockCopy(namespaceBytes, 0, buffer, 0, namespaceBytes.Length);
        Buffer.BlockCopy(nameBytes, 0, buffer, namespaceBytes.Length, nameBytes.Length);

        var hash = SHA256.HashData(buffer);
        var guidBytes = new byte[16];
        Array.Copy(hash, guidBytes, 16);

        // Version 5 indicator (bits 4-7 of time_hi_and_version set to 0101)
        guidBytes[6] = (byte)((guidBytes[6] & 0x0F) | 0x50);
        // Variant (bits 6-7 of clock_seq_hi_and_reserved set to 10)
        guidBytes[8] = (byte)((guidBytes[8] & 0x3F) | 0x80);

        SwapByteOrder(guidBytes);
        return new Guid(guidBytes);
    }

    private static void SwapByteOrder(byte[] guid)
    {
        (guid[0], guid[3]) = (guid[3], guid[0]);
        (guid[1], guid[2]) = (guid[2], guid[1]);
        (guid[4], guid[5]) = (guid[5], guid[4]);
        (guid[6], guid[7]) = (guid[7], guid[6]);
    }
}
